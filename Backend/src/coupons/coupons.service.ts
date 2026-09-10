import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { Coupon, CouponDocument, CouponReservation, CouponReservationDocument } from './coupon.schema';
import { CreateCouponDto, UpdateCouponDto } from './coupon.dto';

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name) private readonly coupons: Model<CouponDocument>,
    @InjectModel(CouponReservation.name) private readonly reservations: Model<CouponReservationDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  generate() {
    return { code: 'HOME-' + randomBytes(8).toString('hex').toUpperCase() };
  }

  list() {
    return this.coupons.find().sort({ createdAt: -1 }).lean().exec();
  }

  private checkExpiry(expiresAt?: string) {
    if (expiresAt !== undefined && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) {
      throw new BadRequestException('Expiration date must be in the future.');
    }
  }

  private duplicate(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      throw new ConflictException('A coupon with this code already exists.');
    }
    throw error;
  }

  async create(dto: CreateCouponDto) {
    this.checkExpiry(dto.expiresAt);
    try { return await this.coupons.create(dto); } catch (error) { this.duplicate(error); }
  }

  async update(id: string, dto: UpdateCouponDto) {
    this.checkExpiry(dto.expiresAt);
    const filter: Record<string, unknown> = { _id: id };
    if (dto.usageLimit != null) filter.$expr = { $lte: [{ $add: ['$usedCount', '$reservedCount'] }, dto.usageLimit] };
    try {
      const coupon = await this.coupons.findOneAndUpdate(filter, { $set: dto }, { new: true, runValidators: true }).exec();
      if (coupon) return coupon;
      if (!await this.coupons.exists({ _id: id })) throw new NotFoundException('Coupon not found.');
      throw new BadRequestException('Usage limit cannot be below paid uses plus active reservations.');
    } catch (error) { this.duplicate(error); }
  }

  async validate(code?: string, session?: ClientSession) {
    const normalized = code?.trim().toUpperCase();
    if (!normalized) return null;
    const coupon = await this.coupons.findOne({ code: normalized }).session(session ?? null).exec();
    if (!coupon) throw new BadRequestException('Invalid coupon code.');
    if (coupon.expiresAt.getTime() <= Date.now()) throw new BadRequestException('Coupon has expired.');
    if (!coupon.active) throw new BadRequestException('Coupon is inactive.');
    if (coupon.usageLimit != null && coupon.usedCount + coupon.reservedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached.');
    }
    return coupon;
  }

  async reserve(order: { _id: Types.ObjectId; couponId?: Types.ObjectId; couponCode: string; discountPercent: number }) {
    if (!order.couponId) return;
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const existing = await this.reservations.findOne({ orderId: order._id }).session(session).exec();
        if (existing?.state === 'held') return;
        if (existing) throw new BadRequestException('Please create a new checkout order.');
        const coupon = await this.validate(order.couponCode, session);
        if (!coupon || !coupon._id.equals(order.couponId!) || coupon.percentage !== order.discountPercent) {
          throw new BadRequestException('Coupon changed. Please review your cart and create a new order.');
        }
        const reserved = await this.coupons.updateOne({
          _id: coupon._id, active: true, expiresAt: { $gt: new Date() },
          $or: [{ usageLimit: null }, { $expr: { $lt: [{ $add: ['$usedCount', '$reservedCount'] }, '$usageLimit'] } }],
        }, { $inc: { reservedCount: 1 } }, { session }).exec();
        if (reserved.modifiedCount !== 1) throw new BadRequestException('Coupon usage limit reached.');
        await this.reservations.create([{ orderId: order._id, couponId: coupon._id, state: 'held' }], { session });
      });
    } finally { await session.endSession(); }
  }

  async consume(orderId: Types.ObjectId, session: ClientSession) {
    const reservation = await this.reservations.findOneAndUpdate(
      { orderId, state: 'held' }, { $set: { state: 'used' } }, { new: true, session },
    ).exec();
    if (!reservation) {
      if (await this.reservations.exists({ orderId, state: 'used' }).session(session)) return;
      throw new BadRequestException('Paid coupon order has no active reservation; reconciliation required.');
    }
    const result = await this.coupons.updateOne(
      { _id: reservation.couponId, reservedCount: { $gt: 0 } },
      { $inc: { reservedCount: -1, usedCount: 1 } }, { session },
    ).exec();
    if (result.modifiedCount !== 1) throw new BadRequestException('Coupon reservation requires reconciliation.');
  }

  async release(orderId: string) {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const reservation = await this.reservations.findOneAndUpdate(
          { orderId, state: 'held' }, { $set: { state: 'released' } }, { new: true, session },
        ).exec();
        if (reservation) {
          const result = await this.coupons.updateOne(
            { _id: reservation.couponId, reservedCount: { $gt: 0 } },
            { $inc: { reservedCount: -1 } }, { session },
          ).exec();
          if (result.modifiedCount !== 1) throw new BadRequestException('Coupon reservation requires reconciliation.');
        }
      });
    } finally { await session.endSession(); }
  }
}
