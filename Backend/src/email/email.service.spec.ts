import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';
import { validateSmtpEnvironment } from './email.config';
import { contactConfirmation, newsletterConfirmation } from './email.templates';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('EmailService', () => {
  const settings: Record<string, unknown> = {
    SMTP_HOST: 'smtp.example.com', SMTP_PORT: 587, SMTP_SECURE: false,
    SMTP_USER: 'test-user', SMTP_PASSWORD: 'secret-test-password',
    SMTP_FROM: 'support@example.com', SMTP_FROM_NAME: 'Test Store',
  };
  const sendMail = jest.fn();
  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    sendMail.mockResolvedValue({ accepted: ['customer@example.com'], rejected: [] });
    service = new EmailService({
      get: (key: string) => settings[key],
      getOrThrow: (key: string) => settings[key],
    } as ConfigService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('reuses a transport and sends both templates from the configured business sender', async () => {
    await service.sendContactConfirmation('customer@example.com', '<script>alert(1)</script>');
    await service.sendNewsletterConfirmation('customer@example.com');
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      secure: false, requireTLS: true, debug: false, logger: false,
      disableFileAccess: true, disableUrlAccess: true,
    }));
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      from: { name: 'Test Store', address: 'support@example.com' },
      to: 'customer@example.com',
      html: expect.stringContaining('&lt;script&gt;'),
      text: expect.stringContaining('<script>'),
    });
    expect(sendMail.mock.calls[1][0]).toMatchObject(newsletterConfirmation());
  });

  it('uses implicit TLS when configured', async () => {
    service = new EmailService({
      get: (key: string) => key === 'SMTP_SECURE' ? true : settings[key],
      getOrThrow: (key: string) => settings[key],
    } as ConfigService);
    await service.sendNewsletterConfirmation('customer@example.com');
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      secure: true, requireTLS: false,
    }));
  });

  it('uses Gmail STARTTLS and sends both multipart templates to an external recipient', async () => {
    const gmailSettings = validateSmtpEnvironment({
      SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '587', SMTP_SECURE: 'false',
      SMTP_USER: 'sender@gmail.com', SMTP_PASSWORD: 'fake-app-password',
      SMTP_FROM: 'sender@gmail.com', SMTP_FROM_NAME: '3legant',
    });
    service = new EmailService(new ConfigService(gmailSettings));
    await service.sendContactConfirmation('customer@example.com', 'Test Customer');
    await service.sendNewsletterConfirmation('customer@example.com');
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true,
      auth: { user: 'sender@gmail.com', pass: 'fake-app-password' },
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      logger: false, debug: false,
    }));
    for (const [message] of sendMail.mock.calls) {
      expect(message).toMatchObject({
        from: { name: '3legant', address: 'sender@gmail.com' },
        to: 'customer@example.com',
        text: expect.any(String), html: expect.stringContaining('<!doctype html>'),
      });
      expect(message.text.length).toBeGreaterThan(0);
    }
  });

  it('delivers contact details to the company inbox with the customer as Reply-To', async () => {
    await service.sendContactNotification(
      'Customer <Name>',
      'customer@example.com',
      'Hello <script>\nPlease contact me.',
    );
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'support@example.com',
      replyTo: 'customer@example.com',
      subject: 'New Contact Us message',
      text: expect.stringContaining('Hello <script>'),
      html: expect.stringContaining('Hello &lt;script&gt;<br>Please contact me.'),
    }));
  });

  it('rejects malformed recipients and subject header injection without sending', async () => {
    await expect(service.sendNewsletterConfirmation('not-an-email')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.send('customer@example.com', {
      ...newsletterConfirmation(), subject: 'Hello\r\nBcc: other@example.com',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('reports missing configuration without connecting', async () => {
    service = new EmailService({ get: () => undefined } as unknown as ConfigService);
    await expect(service.sendNewsletterConfirmation('customer@example.com'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it.each(['authentication', 'timeout', 'recipient rejection'])('handles %s failures without leaking provider data', async (failure) => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    if (failure === 'recipient rejection') {
      sendMail.mockResolvedValue({ accepted: [], rejected: ['customer@example.com'] });
    } else {
      sendMail.mockRejectedValue(new Error('provider diagnostic with secret-test-password'));
    }
    await expect(service.sendNewsletterConfirmation('customer@example.com'))
      .rejects.toThrow('Email could not be sent. Please try again later.');
    expect(logger).toHaveBeenCalledWith('SMTP email delivery failed.');
    expect(JSON.stringify(logger.mock.calls)).not.toContain('secret-test-password');
  });

  it('renders readable plain text and escapes names in HTML', () => {
    expect(contactConfirmation('A & "B"').html).toContain('A &amp; &quot;B&quot;');
    expect(contactConfirmation(' ').text).toContain('Hello there,');
  });
});
