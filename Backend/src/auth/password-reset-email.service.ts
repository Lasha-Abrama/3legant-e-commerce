import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PasswordResetEmailService {
  private readonly logger = new Logger(PasswordResetEmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(to: string, resetUrl: string): Promise<boolean> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from = this.configService.get<string>('EMAIL_FROM');
    if (!apiKey || !from) return false;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Gita_3_Team_2/1.0',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: 'Reset your Gita_3_Team_2 password',
          text: [
            'We received a request to reset your password.',
            '',
            `Reset your password: ${resetUrl}`,
            '',
            'This link expires in one hour. If you did not request a reset, you can ignore this email.',
          ].join('\n'),
        }),
      });

      if (!response.ok) {
        this.logger.error(`Password reset email failed with status ${response.status}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error('Password reset email could not be sent', error);
      return false;
    }
  }
}
