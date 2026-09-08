import { ServiceUnavailableException } from '@nestjs/common';
import { Model } from 'mongoose';
import { EmailService } from '../email/email.service';
import { ContactService } from './contact.service';
import { ContactMessageDocument } from './schemas/contact-message.schema';
import { NewsletterSubscriberDocument } from './schemas/newsletter-subscriber.schema';

describe('ContactService', () => {
  const save = jest.fn();
  const sendContactNotification = jest.fn();
  const sendContactConfirmation = jest.fn();
  let savedPayload: Record<string, unknown>;
  let service: ContactService;

  beforeEach(() => {
    jest.clearAllMocks();
    savedPayload = {};
    save.mockResolvedValue(undefined);
    sendContactNotification.mockResolvedValue(undefined);
    sendContactConfirmation.mockResolvedValue(undefined);
    const contactMessageModel = jest.fn().mockImplementation((payload) => {
      savedPayload = payload;
      return { save };
    }) as unknown as Model<ContactMessageDocument>;
    const newsletterSubscriberModel = {} as Model<NewsletterSubscriberDocument>;
    const emailService = {
      sendContactNotification,
      sendContactConfirmation,
    } as unknown as EmailService;
    service = new ContactService(contactMessageModel, newsletterSubscriberModel, emailService);
  });

  it('stores a normalized message and emails both the company and customer', async () => {
    await expect(service.createMessage({
      name: '  Sofia Havertz  ',
      email: '  SOFIA@EXAMPLE.COM  ',
      message: '  I need help with an order.  ',
    })).resolves.toEqual({
      message: 'Your message was sent successfully. We will get back to you as soon as possible.',
    });
    expect(savedPayload).toEqual({
      name: 'Sofia Havertz',
      email: 'sofia@example.com',
      message: 'I need help with an order.',
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(sendContactNotification).toHaveBeenCalledWith(
      'Sofia Havertz',
      'sofia@example.com',
      'I need help with an order.',
    );
    expect(sendContactConfirmation).toHaveBeenCalledWith('sofia@example.com', 'Sofia Havertz');
  });

  it('returns the safe delivery error when SMTP fails after persistence', async () => {
    sendContactNotification.mockRejectedValue(
      new ServiceUnavailableException('Email could not be sent. Please try again later.'),
    );
    await expect(service.createMessage({
      name: 'Sofia',
      email: 'sofia@example.com',
      message: 'Please help.',
    })).rejects.toThrow('Email could not be sent. Please try again later.');
    expect(save).toHaveBeenCalledTimes(1);
  });
});
