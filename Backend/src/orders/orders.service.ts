import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  CheckoutSessionStatus,
  Order,
  OrderDocument,
  OrderStatus,
  PaymentStatus,
} from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { ProductsService } from '../products/products.service';

const SHIPPING_COST: Record<string, (subtotal: number) => number> = {
  free: () => 0,
  express: () => 15,
  pickup: (subtotal) => -Math.round(subtotal * 0.05 * 100) / 100,
};

const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly productsService: ProductsService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    if (dto.paymentMethod !== 'card') {
      throw new BadRequestException('ამ ეტაპზე მხოლოდ ბარათით გადახდაა ხელმისაწვდომი');
    }
    const products = await Promise.all(
      dto.items.map((item) => this.productsService.findOne(item.productId)),
    );
    const quantities = new Map<string, number>();
    dto.items.forEach((item) => {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.qty);
    });

    const orderItems = dto.items.map((item, index) => {
      const product = products[index];
      const color = (product.colors ?? []).find((option) => option.name === item.color);
      if (!color) {
        throw new BadRequestException(`ფერი მიუწვდომელია: ${item.color}`);
      }
      if ((quantities.get(item.productId) ?? 0) > product.stock) {
        throw new BadRequestException(`პროდუქტი არ არის საკმარისი რაოდენობით: ${product.name}`);
      }
      return {
        productId: product._id,
        name: product.name,
        color: color.name,
        price: product.price,
        qty: item.qty,
      };
    });
    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.qty, 0);
    const shippingCost = SHIPPING_COST[dto.shippingOption](subtotal);
    const total = Math.max(0, Math.round((subtotal + shippingCost) * 100) / 100);

    const order = new this.orderModel({
      user: new Types.ObjectId(userId),
      items: orderItems,
      contact: dto.contact,
      shippingAddress: dto.shippingAddress,
      paymentMethod: dto.paymentMethod,
      shippingOption: dto.shippingOption,
      paymentStatus: 'pending',
      checkoutSessionStatus: 'none',
      inventoryStatus: 'pending',
      subtotal: Math.round(subtotal * 100) / 100,
      total,
    });
    return order.save();
  }

  findByUser(userId: string) {
    return this.orderModel.find({ user: userId }).sort({ createdAt: -1 }).lean().exec();
  }

  async hasPurchasedProduct(userId: string, productId: string) {
    const order = await this.orderModel.exists({
      user: userId,
      paymentStatus: 'paid',
      status: { $ne: 'Cancelled' },
      'items.productId': productId,
    });
    return Boolean(order);
  }

  async findByIdForUser(orderId: string, userId: string) {
    const order = await this.orderModel.findOne({ _id: orderId, user: userId }).exec();
    if (!order) {
      throw new NotFoundException('შეკვეთა ვერ მოიძებნა');
    }
    return order;
  }

  async findById(orderId: string) {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('შეკვეთა ვერ მოიძებნა');
    }
    return order;
  }

  async attachStripeCheckoutSession(
    orderId: string,
    userId: string,
    stripeCheckoutSessionId: string,
    stripeCheckoutExpiresAt: Date,
  ) {
    const order = await this.orderModel
      .findOneAndUpdate(
        {
          _id: orderId,
          user: userId,
          paymentStatus: 'pending',
          status: 'Processing',
          $or: [
            { stripeCheckoutSessionId: { $exists: false } },
            { stripeCheckoutSessionId },
          ],
        },
        {
          $set: {
            stripeCheckoutSessionId,
            stripeCheckoutExpiresAt,
            checkoutSessionStatus: 'open',
          },
        },
        { new: true },
      )
      .exec();
    if (order) {
      return order;
    }

    const existingOrder = await this.findByIdForUser(orderId, userId);
    if (existingOrder.stripeCheckoutSessionId === stripeCheckoutSessionId) {
      return existingOrder;
    }
    throw new ConflictException('A different checkout session is already attached to this order');
  }

  async updateCheckoutSessionStatus(
    orderId: string,
    stripeCheckoutSessionId: string,
    checkoutSessionStatus: CheckoutSessionStatus,
  ) {
    const order = await this.orderModel
      .findOneAndUpdate(
        { _id: orderId, paymentStatus: 'pending' },
        {
          $set: {
            stripeCheckoutSessionId,
            checkoutSessionStatus,
          },
        },
        { new: true },
      )
      .exec();
    if (order) {
      return order;
    }

    return this.findById(orderId);
  }

  async updateStripePayment(
    orderId: string,
    paymentStatus: Extract<PaymentStatus, 'paid' | 'failed'>,
    stripeCheckoutSessionId: string,
    stripePaymentIntentId?: string,
    checkoutSessionStatus: Extract<CheckoutSessionStatus, 'completed' | 'expired' | 'failed'> =
      paymentStatus === 'paid' ? 'completed' : 'failed',
  ) {
    if (paymentStatus === 'paid') {
      return this.markStripePaymentPaid(
        orderId,
        stripeCheckoutSessionId,
        stripePaymentIntentId,
        'completed',
      );
    }

    const allowedCurrentStatuses: PaymentStatus[] =
      ['pending'];
    const paymentUpdate: Record<string, unknown> = {
      paymentStatus,
      stripeCheckoutSessionId,
      checkoutSessionStatus,
    };
    if (stripePaymentIntentId) {
      paymentUpdate.stripePaymentIntentId = stripePaymentIntentId;
    }
    const order = await this.orderModel
      .findOneAndUpdate(
        { _id: orderId, paymentStatus: { $in: allowedCurrentStatuses } },
        { $set: paymentUpdate },
        { new: true },
      )
      .exec();
    if (order) {
      return order;
    }

    const existingOrder = await this.orderModel.findById(orderId).exec();
    if (!existingOrder) {
      throw new NotFoundException('შეკვეთა ვერ მოიძებნა');
    }
    return existingOrder;
  }

  private async markStripePaymentPaid(
    orderId: string,
    stripeCheckoutSessionId: string,
    stripePaymentIntentId?: string,
    checkoutSessionStatus: Extract<CheckoutSessionStatus, 'completed'> = 'completed',
  ) {
    const session = await this.connection.startSession();
    let paidOrder: OrderDocument | null = null;
    try {
      await session.withTransaction(async () => {
        const paymentUpdate: Record<string, unknown> = {
          paymentStatus: 'paid',
          stripeCheckoutSessionId,
          checkoutSessionStatus,
          paidAt: new Date(),
          inventoryStatus: 'adjusted',
          inventoryAdjustedAt: new Date(),
        };
        if (stripePaymentIntentId) {
          paymentUpdate.stripePaymentIntentId = stripePaymentIntentId;
        }

        paidOrder = await this.orderModel
          .findOneAndUpdate(
            { _id: orderId, paymentStatus: { $in: ['pending', 'failed'] } },
            { $set: paymentUpdate },
            { new: true, session },
          )
          .exec();
        if (!paidOrder) {
          paidOrder = await this.orderModel.findById(orderId).session(session).exec();
          if (!paidOrder) {
            throw new NotFoundException('შეკვეთა ვერ მოიძებნა');
          }
          return;
        }

        await this.productsService.decrementStock(paidOrder.items, session);
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        paidOrder = await this.markPaidWithInventoryIssue(
          orderId,
          stripeCheckoutSessionId,
          stripePaymentIntentId,
          checkoutSessionStatus,
        );
      } else {
        throw error;
      }
    } finally {
      await session.endSession();
    }
    return paidOrder;
  }

  private async markPaidWithInventoryIssue(
    orderId: string,
    stripeCheckoutSessionId: string,
    stripePaymentIntentId?: string,
    checkoutSessionStatus: Extract<CheckoutSessionStatus, 'completed'> = 'completed',
  ) {
    const paymentUpdate: Record<string, unknown> = {
      paymentStatus: 'paid',
      stripeCheckoutSessionId,
      checkoutSessionStatus,
      paidAt: new Date(),
      inventoryStatus: 'insufficient',
    };
    if (stripePaymentIntentId) {
      paymentUpdate.stripePaymentIntentId = stripePaymentIntentId;
    }

    const order = await this.orderModel
      .findOneAndUpdate(
        { _id: orderId, paymentStatus: { $in: ['pending', 'failed'] } },
        { $set: paymentUpdate },
        { new: true },
      )
      .exec();
    if (order) {
      return order;
    }

    const existingOrder = await this.orderModel.findById(orderId).exec();
    if (!existingOrder) {
      throw new NotFoundException('შეკვეთა ვერ მოიძებნა');
    }
    return existingOrder;
  }

  async refundStripePayment(stripePaymentIntentId: string, stripeChargeId: string) {
    const session = await this.connection.startSession();
    let refundedOrder: OrderDocument | null = null;
    try {
      await session.withTransaction(async () => {
        refundedOrder = await this.orderModel
          .findOneAndUpdate(
            { stripePaymentIntentId, paymentStatus: 'paid' },
            {
              $set: {
                paymentStatus: 'refunded',
                stripeChargeId,
                refundedAt: new Date(),
              },
            },
            { new: true, session },
          )
          .exec();
        if (!refundedOrder) {
          refundedOrder = await this.orderModel
            .findOne({ stripePaymentIntentId })
            .session(session)
            .exec();
          return;
        }

        if (
          refundedOrder.inventoryStatus === 'adjusted' &&
          refundedOrder.status === 'Processing'
        ) {
          await this.productsService.incrementStock(refundedOrder.items, session);
          const inventoryRestoredAt = new Date();
          await this.orderModel
            .updateOne(
              { _id: refundedOrder._id },
              { $set: { inventoryStatus: 'restored', inventoryRestoredAt } },
              { session },
            )
            .exec();
          refundedOrder.inventoryStatus = 'restored';
          refundedOrder.inventoryRestoredAt = inventoryRestoredAt;
        } else if (refundedOrder.inventoryStatus === 'adjusted') {
          await this.orderModel
            .updateOne(
              { _id: refundedOrder._id },
              { $set: { inventoryStatus: 'return_required' } },
              { session },
            )
            .exec();
          refundedOrder.inventoryStatus = 'return_required';
        }
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        refundedOrder = await this.markRefundedWithInventoryIssue(
          stripePaymentIntentId,
          stripeChargeId,
        );
      } else {
        throw error;
      }
    } finally {
      await session.endSession();
    }
    return refundedOrder;
  }

  private async markRefundedWithInventoryIssue(
    stripePaymentIntentId: string,
    stripeChargeId: string,
  ) {
    const order = await this.orderModel
      .findOneAndUpdate(
        { stripePaymentIntentId, paymentStatus: 'paid' },
        {
          $set: {
            paymentStatus: 'refunded',
            stripeChargeId,
            refundedAt: new Date(),
            inventoryStatus: 'restore_failed',
          },
        },
        { new: true },
      )
      .exec();
    if (order) {
      return order;
    }

    const existingOrder = await this.orderModel.findOne({ stripePaymentIntentId }).exec();
    return existingOrder;
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
    const order = await this.findById(id);
    if (order.status === status) {
      return order;
    }

    if (!ORDER_STATUS_TRANSITIONS[order.status].includes(status)) {
      throw new BadRequestException(
        `Order status cannot change from ${order.status} to ${status}`,
      );
    }
    if (status === 'Shipped') {
      if (order.paymentStatus !== 'paid') {
        throw new BadRequestException('Only paid orders can be shipped');
      }
      if (order.inventoryStatus !== 'adjusted') {
        throw new BadRequestException('Order inventory must be ready before shipping');
      }
    }
    if (status === 'Cancelled') {
      if (order.paymentStatus === 'paid') {
        throw new BadRequestException('Refund the paid order before cancelling it');
      }
      const checkoutExpiresAt = order.stripeCheckoutExpiresAt?.getTime();
      const hasActiveCheckoutSession =
        order.checkoutSessionStatus === 'completed' ||
        (order.checkoutSessionStatus === 'open' &&
          (!checkoutExpiresAt || checkoutExpiresAt > Date.now()));
      if (order.paymentStatus === 'pending' && hasActiveCheckoutSession) {
        throw new BadRequestException('Wait for the active payment session to finish or expire');
      }
    }

    const transitionFilter: Record<string, unknown> = { _id: id, status: order.status };
    if (status === 'Shipped') {
      transitionFilter.paymentStatus = 'paid';
      transitionFilter.inventoryStatus = 'adjusted';
    }
    if (status === 'Cancelled') {
      transitionFilter.$or = [
        { paymentStatus: { $in: ['failed', 'refunded'] } },
        {
          paymentStatus: 'pending',
          checkoutSessionStatus: { $in: ['none', 'expired', 'failed'] },
        },
        {
          paymentStatus: 'pending',
          checkoutSessionStatus: 'open',
          stripeCheckoutExpiresAt: { $lte: new Date() },
        },
      ];
    }

    const updatedOrder = await this.orderModel
      .findOneAndUpdate(
        transitionFilter,
        { $set: { status } },
        { new: true },
      )
      .exec();
    if (updatedOrder) {
      return updatedOrder;
    }

    const latestOrder = await this.findById(id);
    if (latestOrder.status === status) {
      return latestOrder;
    }
    throw new ConflictException('Order status changed while this update was processing');
  }
}
