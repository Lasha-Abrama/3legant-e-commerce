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
    let result;
    try {
      result = await this.newsletterSubscriberModel
        .updateOne({ email }, { $setOnInsert: { email } }, { upsert: true })
        .exec();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        return { message: 'You are already subscribed to our newsletter.' };
      }
      throw error;
    }
    if (result.upsertedCount > 0) {
      const deliveries = await Promise.allSettled([
        this.emailService.sendNewsletterNotification(email),
        this.emailService.sendNewsletterConfirmation(email),
      ]);
      if (deliveries.some((delivery) => delivery.status === 'rejected')) {
        throw new ServiceUnavailableException(
          'Your subscription was saved, but email delivery is temporarily unavailable.',
        );
      }
      return { message: 'You successfully joined our newsletter. Please check your email.' };
    }
    return { message: 'You are already subscribed to our newsletter.' };
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
