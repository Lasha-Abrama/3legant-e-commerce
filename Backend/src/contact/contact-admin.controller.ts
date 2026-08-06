import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ContactService } from './contact.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';

@Controller('admin')
@UseGuards(AdminGuard)
export class ContactAdminController {
  constructor(private readonly contactService: ContactService) {}

  @Get('contact-messages')
  findAllMessages() {
    return this.contactService.findAllMessages();
  }

  @Delete('contact-messages/:id')
  removeMessage(@Param('id', ParseObjectIdPipe) id: string) {
    return this.contactService.removeMessage(id);
  }

  @Get('newsletter-subscribers')
  findAllSubscribers() {
    return this.contactService.findAllSubscribers();
  }

  @Delete('newsletter-subscribers/:id')
  removeSubscriber(@Param('id', ParseObjectIdPipe) id: string) {
    return this.contactService.removeSubscriber(id);
  }
}
