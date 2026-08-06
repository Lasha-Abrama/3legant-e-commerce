import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContactMessage, ContactMessageDocument } from './schemas/contact-message.schema';
import {
  NewsletterSubscriber,
  NewsletterSubscriberDocument,
} from './schemas/newsletter-subscriber.schema';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { SubscribeDto } from './dto/subscribe.dto';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(ContactMessage.name)
    private readonly contactMessageModel: Model<ContactMessageDocument>,
    @InjectModel(NewsletterSubscriber.name)
    private readonly newsletterSubscriberModel: Model<NewsletterSubscriberDocument>,
  ) {}

  async createMessage(dto: CreateContactMessageDto) {
    await new this.contactMessageModel(dto).save();
    return { message: 'შეტყობინება წარმატებით გაიგზავნა' };
  }

  async subscribe(dto: SubscribeDto) {
    await this.newsletterSubscriberModel
      .updateOne({ email: dto.email.toLowerCase().trim() }, { $setOnInsert: dto }, { upsert: true })
      .exec();
    return { message: 'გამოწერა დადასტურებულია' };
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
