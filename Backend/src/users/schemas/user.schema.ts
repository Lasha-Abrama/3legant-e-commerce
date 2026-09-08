import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class Address {
  @Prop({ trim: true, default: '' })
  fullName: string;

  @Prop({ trim: true, default: '' })
  phone: string;

  @Prop({ trim: true, default: '' })
  street: string;

  @Prop({ trim: true, default: '' })
  city: string;

  @Prop({ trim: true, default: '' })
  state: string;

  @Prop({ trim: true, default: '' })
  zip: string;

  @Prop({ trim: true, default: '' })
  country: string;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ select: false })
  passwordHash?: string;

  @Prop({ unique: true, sparse: true, trim: true })
  googleId?: string;

  @Prop({ trim: true, default: '' })
  displayName: string;

  @Prop({ trim: true, default: '' })
  phone: string;

  @Prop({ trim: true, default: '' })
  profileImageUrl: string;

  @Prop({ select: false, trim: true, default: '' })
  profileImagePublicId?: string;

  @Prop({ type: AddressSchema, default: () => ({}) })
  billingAddress: Address;

  @Prop({ type: AddressSchema, default: () => ({}) })
  shippingAddress: Address;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Product', default: [] })
  wishlist: Types.ObjectId[];

  @Prop({ default: false })
  isAdmin: boolean;

  @Prop({ required: true, default: 0, min: 0 })
  tokenVersion: number;

  @Prop({ select: false })
  passwordResetTokenHash?: string;

  @Prop({ select: false })
  passwordResetExpiresAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
