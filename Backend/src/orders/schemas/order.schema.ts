import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

export const ORDER_STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'] as const;
export const PAYMENT_METHODS = ['card', 'paypal'] as const;
export const SHIPPING_OPTIONS = ['free', 'express', 'pickup'] as const;
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
export const INVENTORY_STATUSES = ['pending', 'adjusted', 'insufficient'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type ShippingOption = (typeof SHIPPING_OPTIONS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, default: 'Default' })
  color: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 1 })
  qty: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ _id: false })
export class OrderContact {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: true, trim: true })
  email: string;
}

export const OrderContactSchema = SchemaFactory.createForClass(OrderContact);

@Schema({ _id: false })
export class OrderShippingAddress {
  @Prop({ required: true, trim: true })
  street: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ required: true, trim: true })
  state: string;

  @Prop({ required: true, trim: true })
  zip: string;

  @Prop({ required: true, trim: true })
  country: string;
}

export const OrderShippingAddressSchema = SchemaFactory.createForClass(OrderShippingAddress);

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ type: OrderContactSchema, required: true })
  contact: OrderContact;

  @Prop({ type: OrderShippingAddressSchema, required: true })
  shippingAddress: OrderShippingAddress;

  @Prop({ required: true, enum: PAYMENT_METHODS, trim: true })
  paymentMethod: PaymentMethod;

  @Prop({ required: true, enum: SHIPPING_OPTIONS, trim: true })
  shippingOption: ShippingOption;

  @Prop({ required: true, enum: PAYMENT_STATUSES, default: 'pending' })
  paymentStatus: PaymentStatus;

  @Prop({ trim: true })
  stripeCheckoutSessionId?: string;

  @Prop({ trim: true })
  stripePaymentIntentId?: string;

  @Prop()
  paidAt?: Date;

  @Prop({ required: true, enum: INVENTORY_STATUSES, default: 'pending' })
  inventoryStatus: InventoryStatus;

  @Prop()
  inventoryAdjustedAt?: Date;

  @Prop({ required: true, min: 0 })
  subtotal: number;

  @Prop({ required: true, min: 0 })
  total: number;

  @Prop({ enum: ORDER_STATUSES, default: 'Processing' })
  status: OrderStatus;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
