import { ConfigService } from '@nestjs/config';
import { PasswordResetEmailService } from './password-reset-email.service';

describe('PasswordResetEmailService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips delivery when development email is not configured', async () => {
    const configService = { get: jest.fn() } as unknown as ConfigService;
    const service = new PasswordResetEmailService(configService);

    await expect(service.send('user@example.com', 'http://localhost/reset')).resolves.toBe(false);
  });

  it('sends a reset link through the configured email API', async () => {
    const configService = {
      get: jest.fn((key: string) => key === 'RESEND_API_KEY' ? 're_example' : 'Store <noreply@example.com>'),
    } as unknown as ConfigService;
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    const service = new PasswordResetEmailService(configService);

    await expect(service.send('user@example.com', 'https://store.example/reset')).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer re_example' }),
      }),
    );
    const request = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      from: 'Store <noreply@example.com>',
      to: ['user@example.com'],
    });
  });
});
