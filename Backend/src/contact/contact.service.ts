import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContactMessage, ContactMessageDocument } from './schemas/contact-message.schema';
import {
  NewsletterSubscriber,
  NewsletterSubscriberDocument,
} from './schemas/newsletter-subscriber.schema';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { SubscribeDto } from './dto/subscribe.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(ContactMessage.name)
    private readonly contactMessageModel: Model<ContactMessageDocument>,
    @InjectModel(NewsletterSubscriber.name)
    private readonly newsletterSubscriberModel: Model<NewsletterSubscriberDocument>,
    private readonly emailService: EmailService,
  ) {}

  async createMessage(dto: CreateContactMessageDto) {
    const normalized = {
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
      message: dto.message.trim(),
    };
    await new this.contactMessageModel(normalized).save();
    const deliveries = await Promise.allSettled([
      this.emailService.sendContactNotification(
        normalized.name,
        normalized.email,
        normalized.message,
      ),
      this.emailService.sendContactConfirmation(normalized.email, normalized.name),
    ]);
    if (deliveries.some((delivery) => delivery.status === 'rejected')) {
      throw new ServiceUnavailableException(
        'Your message was saved, but email delivery is temporarily unavailable.',
      );
    }
    return { message: 'Your message was sent successfully. We will get back to you as soon as possible.' };
  }

  async subscribe(dto: SubscribeDto) {
    const email = dto.email.toLowerCase().trim();
    try {
      await this.newsletterSubscriberModel
        .updateOne({ email }, { $setOnInsert: { email, emailDeliveryPending: true } }, { upsert: true })
        .exec();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        // Another request inserted this address; use the same delivery claim below.
      } else {
        throw error;
      }
    }
    // Claim delivery briefly so retries can recover failures without concurrent sends.
    // Existing legacy records without emailDeliveryPending are left untouched.
    const subscriber = await this.newsletterSubscriberModel.findOneAndUpdate(
      {
        email,
        emailDeliveryPending: true,
        $or: [
          { emailDeliveryClaimedUntil: { $exists: false } },
          { emailDeliveryClaimedUntil: { $lte: new Date() } },
        ],
      },
      { $set: { emailDeliveryClaimedUntil: new Date(Date.now() + 120_000) } },
      { returnDocument: 'after' },
    ).exec();
    if (!subscriber) return { message: 'You are already subscribed to our newsletter.' };

    const deliveries = await Promise.allSettled([
      subscriber.notificationEmailSent ? Promise.resolve() : this.emailService.sendNewsletterNotification(email),
      subscriber.confirmationEmailSent ? Promise.resolve() : this.emailService.sendNewsletterConfirmation(email),
    ]);
    const failed = deliveries.some((delivery) => delivery.status === 'rejected');
    await this.newsletterSubscriberModel.updateOne(
      { _id: subscriber._id },
      {
        $set: {
          notificationEmailSent: deliveries[0].status === 'fulfilled',
          confirmationEmailSent: deliveries[1].status === 'fulfilled',
          emailDeliveryPending: failed,
        },
        $unset: { emailDeliveryClaimedUntil: 1 },
      },
    ).exec();
    if (failed) {
      throw new ServiceUnavailableException(
        'Your subscription was saved, but email delivery is temporarily unavailable. Submit again later to retry delivery.',
      );
    }
    return { message: 'You successfully joined our newsletter. Please check your email.' };
  }

  findAllMessages() {
    return this.contactMessageModel.find().sort({ createdAt: -1 }).lean().exec();
  }

  async removeMessage(id: string) {
    const deleted = await this.contactMessageModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('შეტყობინება ვერ მოიძებნა');
    }
    return { message: 'წაიშალა' };
  }

  findAllSubscribers() {
    return this.newsletterSubscriberModel.find().sort({ createdAt: -1 }).lean().exec();
  }

  async removeSubscriber(id: string) {
    const deleted = await this.newsletterSubscriberModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('გამომწერი ვერ მოიძებნა');
    }
    return { message: 'წაიშალა' };
  }
}
