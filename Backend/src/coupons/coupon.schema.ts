import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Coupon {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string;

  @Prop({ required: true, min: 1, max: 100 })
  percentage: number;

  @Prop({ type: Number, min: 1, default: null })
  usageLimit: number | null;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: true })
  active: boolean;

  @Prop({ default: 0, min: 0 })
  usedCount: number;

  @Prop({ default: 0, min: 0 })
  reservedCount: number;
}

export type CouponDocument = HydratedDocument<Coupon>;
export const CouponSchema = SchemaFactory.createForClass(Coupon);

@Schema({ timestamps: true })
export class CouponReservation {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Order', required: true, unique: true })
  orderId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Coupon', required: true })
  couponId: Types.ObjectId;

  @Prop({ enum: ['held', 'used', 'released'], required: true })
  state: 'held' | 'used' | 'released';
}

export type CouponReservationDocument = HydratedDocument<CouponReservation>;
export const CouponReservationSchema = SchemaFactory.createForClass(CouponReservation);
