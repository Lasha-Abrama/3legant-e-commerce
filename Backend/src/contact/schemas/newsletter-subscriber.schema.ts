import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NewsletterSubscriberDocument = HydratedDocument<NewsletterSubscriber>;

@Schema({ timestamps: true })
export class NewsletterSubscriber {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @Prop({ default: false })
  confirmationEmailSent: boolean;

  @Prop({ default: false })
  notificationEmailSent: boolean;

  @Prop({ default: false })
  emailDeliveryPending: boolean;

  @Prop()
  emailDeliveryClaimedUntil?: Date;
}

export const NewsletterSubscriberSchema = SchemaFactory.createForClass(NewsletterSubscriber);
