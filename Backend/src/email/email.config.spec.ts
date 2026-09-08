import { validateSmtpEnvironment } from './email.config';

describe('SMTP configuration', () => {
  const settings = {
    SMTP_HOST: 'smtp.example.com', SMTP_USER: 'test-user',
    SMTP_PASSWORD: ' secret with spaces ', SMTP_FROM: 'support@example.com',
  };

  it('allows SMTP to remain disabled', () => {
    expect(validateSmtpEnvironment({})).toMatchObject({ SMTP_HOST: '', SMTP_PORT: 587, SMTP_SECURE: false });
  });

  it('parses booleans and ports without modifying passwords', () => {
    expect(validateSmtpEnvironment({ ...settings, SMTP_PORT: '465', SMTP_SECURE: 'true' }))
      .toMatchObject({ SMTP_PORT: 465, SMTP_SECURE: true, SMTP_PASSWORD: settings.SMTP_PASSWORD });
  });

  it.each([
    { SMTP_HOST: 'smtp.example.com' },
    { ...settings, SMTP_PORT: 'invalid' },
    { ...settings, SMTP_PORT: '65536' },
    { ...settings, SMTP_SECURE: 'yes' },
    { ...settings, SMTP_FROM: 'invalid' },
    { ...settings, SMTP_FROM_NAME: 'Store\r\nBcc: other@example.com' },
  ])('rejects invalid configuration without leaking values', (input) => {
    expect(() => validateSmtpEnvironment(input)).toThrow('Environment validation failed:');
    try { validateSmtpEnvironment(input); } catch (error) {
      expect(String(error)).not.toContain(settings.SMTP_PASSWORD);
    }
  });

  it('rejects an invalid contact recipient', () => {
    expect(() => validateSmtpEnvironment({ CONTACT_RECIPIENT_EMAIL: 'not-an-email' }))
      .toThrow('CONTACT_RECIPIENT_EMAIL must be a single email address');
  });
});
