import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type BlogDocument = HydratedDocument<Blog>;

@Schema({ timestamps: true })
export class Blog {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  author?: Types.ObjectId;

  @Prop({ trim: true, default: 'Design' })
  category: string;

  @Prop({ type: [String], default: [] })
  supportingImages: string[];
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ trim: true, default: '' })
  excerpt: string;

  @Prop({ required: true, trim: true })
  content: string;

  @Prop({ required: true, trim: true })
  image: string;

  @Prop({ default: false })
  featured: boolean;
}

export const BlogSchema = SchemaFactory.createForClass(Blog);
BlogSchema.index({ createdAt: -1 });
BlogSchema.index({ featured: 1, createdAt: -1 });
BlogSchema.index({ category: 1, createdAt: -1 });
