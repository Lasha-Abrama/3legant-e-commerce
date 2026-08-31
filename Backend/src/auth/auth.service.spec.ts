import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PasswordResetEmailService } from './password-reset-email.service';

describe('AuthService', () => {
  const usersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    toSafeUser: jest.fn(),
    invalidateAccessTokens: jest.fn(),
    setPasswordResetToken: jest.fn(),
    resetPasswordWithToken: jest.fn(),
  } as unknown as UsersService;
  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as unknown as JwtService;
  const configService = {
    get: jest.fn((key: string) => key === 'NODE_ENV' ? 'development' : undefined),
    getOrThrow: jest.fn((key: string) => key === 'FRONTEND_URL' ? 'http://localhost:5000' : undefined),
  } as unknown as ConfigService;
  const passwordResetEmailService = {
    send: jest.fn(),
  } as unknown as PasswordResetEmailService;
  const service = new AuthService(usersService, jwtService, configService, passwordResetEmailService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a user with a hashed password', async () => {
    const createdUser = { _id: 'user-id' };
    usersService.findByEmail = jest.fn().mockResolvedValue(null);
    usersService.create = jest.fn().mockResolvedValue(createdUser);
    usersService.findById = jest.fn().mockResolvedValue(createdUser);
    usersService.toSafeUser = jest.fn().mockReturnValue({ id: 'user-id' });
    jwtService.signAsync = jest.fn().mockResolvedValue('access-token');

    const response = await service.register({
      firstName: 'Sofia',
      lastName: 'Havertz',
      email: 'SOFIA@example.com',
      password: 'password123',
    });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'SOFIA@example.com',
        passwordHash: expect.any(String),
      }),
    );
    expect((usersService.create as jest.Mock).mock.calls[0][0].passwordHash).not.toBe('password123');
    expect(response).toEqual({ _id: 'user-id' });
  });

  it('rejects duplicate email registration', async () => {
    usersService.findByEmail = jest.fn().mockResolvedValue({ _id: 'existing-user' });

    await expect(
      service.register({
        firstName: 'Sofia',
        lastName: 'Havertz',
        email: 'sofia@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('issues a JWT after validating credentials', async () => {
    const user = { _id: 'user-id', passwordHash: '$2b$10$abcdefghijklmnopqrstuu' };
    usersService.findByEmail = jest.fn().mockResolvedValue(user);
    usersService.findById = jest.fn().mockResolvedValue(user);
    usersService.toSafeUser = jest.fn().mockReturnValue({ id: 'user-id' });
    jwtService.signAsync = jest.fn().mockResolvedValue('access-token');

    const response = await service.createAuthResponse('user-id');

    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-id',
      tokenVersion: 0,
    });
    expect(response).toEqual({ accessToken: 'access-token', user: { id: 'user-id' } });
  });

  it('returns no user for a missing or invalid authorization header', async () => {
    expect(await service.getUserFromAuthorization()).toBeNull();

    jwtService.verifyAsync = jest.fn().mockRejectedValue(new Error('invalid token'));
    expect(await service.getUserFromAuthorization('Bearer invalid-token')).toBeNull();
  });

  it('rejects a valid JWT issued before the user token version changed', async () => {
    jwtService.verifyAsync = jest.fn().mockResolvedValue({
      sub: 'user-id',
      tokenVersion: 1,
    });
    usersService.findById = jest.fn().mockResolvedValue({
      _id: 'user-id',
      tokenVersion: 2,
    });

    await expect(
      service.getUserFromAuthorization('Bearer stale-token'),
    ).resolves.toBeNull();
    expect(usersService.toSafeUser).not.toHaveBeenCalled();
  });

  it('invalidates existing access tokens on logout', async () => {
    usersService.invalidateAccessTokens = jest.fn().mockResolvedValue(undefined);

    await expect(service.logout('user-id')).resolves.toEqual({
      message: 'წარმატებით გამოხვედით',
    });
    expect(usersService.invalidateAccessTokens).toHaveBeenCalledWith('user-id');
  });

  it('creates a hashed reset token and development link for an existing account', async () => {
    usersService.setPasswordResetToken = jest.fn().mockResolvedValue({ email: 'sofia@example.com' });
    passwordResetEmailService.send = jest.fn().mockResolvedValue(false);

    const response = await service.requestPasswordReset('SOFIA@example.com');

    expect(usersService.setPasswordResetToken).toHaveBeenCalledWith(
      'SOFIA@example.com',
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
    expect(response.message).toContain('If an account exists');
    expect(response.developmentResetUrl).toMatch(/^http:\/\/localhost:5000\/reset-password\.html\?token=/);
    expect(response.developmentResetUrl).not.toContain(
      (usersService.setPasswordResetToken as jest.Mock).mock.calls[0][1],
    );
  });

  it('returns the same generic reset response for a missing account', async () => {
    usersService.setPasswordResetToken = jest.fn().mockResolvedValue(null);

    await expect(service.requestPasswordReset('missing@example.com')).resolves.toEqual({
      message: 'If an account exists for that email, a password reset link has been sent.',
    });
    expect(passwordResetEmailService.send).not.toHaveBeenCalled();
  });

  it('hashes the new password before completing a reset', async () => {
    usersService.resetPasswordWithToken = jest.fn().mockResolvedValue(undefined);

    await expect(service.resetPassword('a'.repeat(43), 'new-password')).resolves.toEqual({
      message: 'Your password has been reset. You can now sign in.',
    });
    const [tokenHash, passwordHash] = (usersService.resetPasswordWithToken as jest.Mock).mock.calls[0];
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(passwordHash).not.toBe('new-password');
    await expect(bcrypt.compare('new-password', passwordHash)).resolves.toBe(true);
  });
});
