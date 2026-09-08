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
  const sendNewsletterNotification = jest.fn();
  const sendNewsletterConfirmation = jest.fn();
  const updateOne = jest.fn();
  const exec = jest.fn();
  const claimExec = jest.fn();
  const findOneAndUpdate = jest.fn();
  let savedPayload: Record<string, unknown>;
  let service: ContactService;

  beforeEach(() => {
    jest.clearAllMocks();
    savedPayload = {};
    save.mockResolvedValue(undefined);
    sendContactNotification.mockResolvedValue(undefined);
    sendContactConfirmation.mockResolvedValue(undefined);
    sendNewsletterNotification.mockResolvedValue(undefined);
    sendNewsletterConfirmation.mockResolvedValue(undefined);
    exec.mockResolvedValue({ upsertedCount: 1 });
    updateOne.mockReturnValue({ exec });
    claimExec.mockResolvedValue({ _id: 'subscriber-id', confirmationEmailSent: false, notificationEmailSent: false });
    findOneAndUpdate.mockReturnValue({ exec: claimExec });
    const contactMessageModel = jest.fn().mockImplementation((payload) => {
      savedPayload = payload;
      return { save };
    }) as unknown as Model<ContactMessageDocument>;
    const newsletterSubscriberModel = { updateOne, findOneAndUpdate } as unknown as Model<NewsletterSubscriberDocument>;
    const emailService = {
      sendContactNotification,
      sendContactConfirmation,
      sendNewsletterNotification,
      sendNewsletterConfirmation,
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
    })).rejects.toThrow('Your message was saved, but email delivery is temporarily unavailable.');
    expect(save).toHaveBeenCalledTimes(1);
    expect(sendContactConfirmation).toHaveBeenCalledTimes(1);
  });

  it('stores a new subscriber and emails both the company and subscriber', async () => {
    await expect(service.subscribe({ email: '  CUSTOMER@GMAIL.COM  ' })).resolves.toEqual({
      message: 'You successfully joined our newsletter. Please check your email.',
    });
    expect(updateOne).toHaveBeenCalledWith(
      { email: 'customer@gmail.com' },
      { $setOnInsert: { email: 'customer@gmail.com', emailDeliveryPending: true } },
      { upsert: true },
    );
    expect(sendNewsletterNotification).toHaveBeenCalledWith('customer@gmail.com');
    expect(sendNewsletterConfirmation).toHaveBeenCalledWith('customer@gmail.com');
  });

  it('does not send duplicate emails for an existing subscriber', async () => {
    exec.mockResolvedValue({ upsertedCount: 0 });
    claimExec.mockResolvedValue(null);
    await expect(service.subscribe({ email: 'customer@gmail.com' })).resolves.toEqual({
      message: 'You are already subscribed to our newsletter.',
    });
    expect(sendNewsletterNotification).not.toHaveBeenCalled();
    expect(sendNewsletterConfirmation).not.toHaveBeenCalled();
  });

  it('handles a concurrent duplicate insert without sending emails', async () => {
    exec.mockRejectedValueOnce({ code: 11000 });
    claimExec.mockResolvedValue(null);
    await expect(service.subscribe({ email: 'customer@gmail.com' })).resolves.toEqual({
      message: 'You are already subscribed to our newsletter.',
    });
    expect(sendNewsletterNotification).not.toHaveBeenCalled();
    expect(sendNewsletterConfirmation).not.toHaveBeenCalled();
  });

  it('returns a safe error if newsletter email delivery fails after persistence', async () => {
    sendNewsletterConfirmation.mockRejectedValue(
      new ServiceUnavailableException('Email could not be sent. Please try again later.'),
    );
    await expect(service.subscribe({ email: 'customer@gmail.com' }))
      .rejects.toThrow('Your subscription was saved, but email delivery is temporarily unavailable.');
    expect(sendNewsletterNotification).toHaveBeenCalledTimes(1);
    expect(sendNewsletterConfirmation).toHaveBeenCalledTimes(1);
  });
  it('retries a failed confirmation without resending the successful notification', async () => {
    exec.mockResolvedValue({ upsertedCount: 0 });
    claimExec.mockResolvedValue({ _id: 'subscriber-id', confirmationEmailSent: false, notificationEmailSent: true });
    await expect(service.subscribe({ email: 'customer@gmail.com' })).resolves.toHaveProperty('message');
    expect(sendNewsletterConfirmation).toHaveBeenCalledTimes(1);
    expect(sendNewsletterNotification).not.toHaveBeenCalled();
    expect(updateOne).toHaveBeenLastCalledWith({ _id: 'subscriber-id' }, {
      $set: { confirmationEmailSent: true, notificationEmailSent: true, emailDeliveryPending: false },
      $unset: { emailDeliveryClaimedUntil: 1 },
    });
  });

});
