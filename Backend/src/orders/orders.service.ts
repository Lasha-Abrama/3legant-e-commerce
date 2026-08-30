import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus, PaymentStatus } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { ProductsService } from '../products/products.service';

const SHIPPING_COST: Record<string, (subtotal: number) => number> = {
  free: () => 0,
  express: () => 15,
  pickup: (subtotal) => -Math.round(subtotal * 0.05 * 100) / 100,
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
      inventoryStatus: 'pending',
      subtotal: Math.round(subtotal * 100) / 100,
      total,
    });
    return order.save();
  }

  findByUser(userId: string) {
    return this.orderModel.find({ user: userId }).sort({ createdAt: -1 }).lean().exec();
  }

  async findByIdForUser(orderId: string, userId: string) {
    const order = await this.orderModel.findOne({ _id: orderId, user: userId }).exec();
    if (!order) {
      throw new NotFoundException('შეკვეთა ვერ მოიძებნა');
    }
    return order;
  }

  async updateStripePayment(
    orderId: string,
    paymentStatus: Extract<PaymentStatus, 'paid' | 'failed'>,
    stripeCheckoutSessionId: string,
    stripePaymentIntentId?: string,
  ) {
    if (paymentStatus === 'paid') {
      return this.markStripePaymentPaid(
        orderId,
        stripeCheckoutSessionId,
        stripePaymentIntentId,
      );
    }

    const allowedCurrentStatuses: PaymentStatus[] =
      ['pending'];
    const paymentUpdate: Record<string, unknown> = {
      paymentStatus,
      stripeCheckoutSessionId,
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
  ) {
    const session = await this.connection.startSession();
    let paidOrder: OrderDocument | null = null;
    try {
      await session.withTransaction(async () => {
        const paymentUpdate: Record<string, unknown> = {
          paymentStatus: 'paid',
          stripeCheckoutSessionId,
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
  ) {
    const paymentUpdate: Record<string, unknown> = {
      paymentStatus: 'paid',
      stripeCheckoutSessionId,
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
