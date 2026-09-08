import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import * as nodemailer from 'nodemailer';
import SMTPTransport = require('nodemailer/lib/smtp-transport');
import {
  contactConfirmation,
  contactNotification,
  EmailContent,
  newsletterConfirmation,
  newsletterNotification,
} from './email.templates';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: nodemailer.Transporter<SMTPTransport.SMTPSentMessageInfo>;

  constructor(private readonly config: ConfigService) {}

  async send(to: string, content: EmailContent): Promise<void> {
    return this.deliver(to, content);
  }

  async sendContactNotification(name: string, email: string, message: string): Promise<void> {
    const recipient = this.config.get<string>('CONTACT_RECIPIENT_EMAIL')
      || this.config.getOrThrow<string>('SMTP_FROM');
    return this.deliver(recipient, contactNotification(name, email, message), email);
  }

  private async deliver(to: string, content: EmailContent, replyTo?: string): Promise<void> {
    const recipient = typeof to === 'string' ? to.trim() : '';
    const normalizedReplyTo = typeof replyTo === 'string' ? replyTo.trim() : replyTo;
    if (!isEmail(recipient) || /[\r\n]/.test(recipient)
      || (normalizedReplyTo !== undefined
        && (typeof normalizedReplyTo !== 'string'
          || !isEmail(normalizedReplyTo)
          || /[\r\n]/.test(normalizedReplyTo)))
      || !content || typeof content.subject !== 'string' || !content.subject.trim()
      || /[\r\n]/.test(content.subject)
      || typeof content.text !== 'string' || !content.text.trim()
      || typeof content.html !== 'string') {
      throw new BadRequestException('Invalid email message.');
    }
    const transporter = this.getTransporter();
    try {
      const result = await transporter.sendMail({
        from: {
          name: this.config.get<string>('SMTP_FROM_NAME') || '',
          address: this.config.getOrThrow<string>('SMTP_FROM'),
        },
        ...(normalizedReplyTo ? { replyTo: normalizedReplyTo } : {}),
        to: recipient,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
      if (!result.accepted?.length || result.rejected?.length) {
        throw new Error('Recipient rejected');
      }
    } catch {
      this.logger.error('SMTP email delivery failed.');
      throw new ServiceUnavailableException('Email could not be sent. Please try again later.');
    }
  }

  sendContactConfirmation(to: string, name: string): Promise<void> {
    return this.deliver(to, contactConfirmation(name));
  }

  sendNewsletterConfirmation(to: string): Promise<void> {
    return this.deliver(to, newsletterConfirmation());
  }

  async sendNewsletterNotification(email: string): Promise<void> {
    const recipient = this.config.get<string>('CONTACT_RECIPIENT_EMAIL')
      || this.config.getOrThrow<string>('SMTP_FROM');
    return this.deliver(recipient, newsletterNotification(email));
  }

  private getTransporter() {
    if (this.transporter) return this.transporter;
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    if (!host || !user || !pass || !this.config.get<string>('SMTP_FROM')) {
      throw new ServiceUnavailableException('Email delivery is not configured.');
    }
    const secure = this.config.get<boolean>('SMTP_SECURE') === true;
    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT') || 587,
      secure,
      requireTLS: !secure,
      auth: { user, pass },
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    return this.transporter;
  }
}
