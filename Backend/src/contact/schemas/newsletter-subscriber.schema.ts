import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NewsletterSubscriberDocument = HydratedDocument<NewsletterSubscriber>;

@Schema({ timestamps: true })
export class NewsletterSubscriber {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;
}

export const NewsletterSubscriberSchema = SchemaFactory.createForClass(NewsletterSubscriber);
