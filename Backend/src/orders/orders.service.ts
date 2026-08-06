import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';

const SHIPPING_COST: Record<string, (subtotal: number) => number> = {
  free: () => 0,
  express: () => 15,
  pickup: (subtotal) => -Math.round(subtotal * 0.05 * 100) / 100,
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    const subtotal = dto.items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const shippingCost = SHIPPING_COST[dto.shippingOption](subtotal);
    const total = Math.max(0, Math.round((subtotal + shippingCost) * 100) / 100);

    const order = new this.orderModel({
      user: new Types.ObjectId(userId),
      items: dto.items.map((item) => ({ ...item, productId: new Types.ObjectId(item.productId) })),
      contact: dto.contact,
      shippingAddress: dto.shippingAddress,
      paymentMethod: dto.paymentMethod,
      shippingOption: dto.shippingOption,
      subtotal: Math.round(subtotal * 100) / 100,
      total,
    });
    return order.save();
  }

  findByUser(userId: string) {
    return this.orderModel.find({ user: userId }).sort({ createdAt: -1 }).lean().exec();
  }

  findAll() {
    return this.orderModel
      .find()
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.orderModel.findByIdAndUpdate(id, { status }, { new: true }).exec();
    if (!order) {
      throw new NotFoundException('შეკვეთა ვერ მოიძებნა');
    }
    return order;
  }
}
