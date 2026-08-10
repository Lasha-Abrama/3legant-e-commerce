import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BlogDocument = HydratedDocument<Blog>;

@Schema({ timestamps: true })
export class Blog {
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
