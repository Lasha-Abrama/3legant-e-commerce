import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContactMessage, ContactMessageSchema } from './schemas/contact-message.schema';
import {
  NewsletterSubscriber,
  NewsletterSubscriberSchema,
} from './schemas/newsletter-subscriber.schema';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { ContactAdminController } from './contact-admin.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContactMessage.name, schema: ContactMessageSchema },
      { name: NewsletterSubscriber.name, schema: NewsletterSubscriberSchema },
    ]),
    UsersModule,
  ],
  controllers: [ContactController, ContactAdminController],
  providers: [ContactService],
})
export class ContactModule {}
