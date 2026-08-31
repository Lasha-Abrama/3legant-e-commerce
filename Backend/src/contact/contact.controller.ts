import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { SubscribeDto } from './dto/subscribe.dto';

@Controller()
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post('contact')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  createMessage(@Body() dto: CreateContactMessageDto) {
    return this.contactService.createMessage(dto);
  }

  @Post('newsletter')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  subscribe(@Body() dto: SubscribeDto) {
    return this.contactService.subscribe(dto);
  }
}
