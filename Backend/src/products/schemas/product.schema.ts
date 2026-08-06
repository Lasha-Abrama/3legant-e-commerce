import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

export const PRODUCT_CATEGORIES = [
  'Living Room',
  'Bedroom',
  'Kitchen',
  'Bathroom',
  'Dining',
  'Outdoor',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

@Schema({ _id: false })
export class ProductColor {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  hex: string;
}

export const ProductColorSchema = SchemaFactory.createForClass(ProductColor);

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ required: true, enum: PRODUCT_CATEGORIES })
  category: ProductCategory;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ type: Number, min: 0, default: null })
  originalPrice: number | null;

  @Prop({ type: [ProductColorSchema], default: () => [{ name: 'Default', hex: '#c9c4b8' }] })
  colors: ProductColor[];

  @Prop({ default: false })
  newArrival: boolean;

  @Prop({ type: String, trim: true, default: null })
  discountLabel: string | null;

  @Prop({ required: true, trim: true })
  sku: string;

  @Prop({ trim: true, default: '' })
  measurements: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true, trim: true })
  imageLabel: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ min: 0, max: 5, default: 5 })
  ratingAvg: number;

  @Prop({ min: 0, default: 0 })
  reviewsCount: number;

  @Prop({ min: 0, default: 50 })
  stock: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
