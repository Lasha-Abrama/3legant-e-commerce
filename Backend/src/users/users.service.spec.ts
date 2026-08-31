import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const userModel = jest.fn();
  const service = new UsersService(userModel as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes profile emails before saving', async () => {
    const user = {
      _id: 'user-id',
      email: 'old@example.com',
      save: jest.fn().mockResolvedValue(undefined),
    };
    user.save.mockResolvedValue(user);
    service.findById = jest.fn().mockResolvedValue(user as never);
    (userModel as any).findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.updateProfile('user-id', { email: '  NEW@Example.com  ' }),
    ).resolves.toBe(user);
    expect((userModel as any).findOne).toHaveBeenCalledWith({
      _id: { $ne: 'user-id' },
      email: 'new@example.com',
    });
    expect(user.email).toBe('new@example.com');
  });

  it('rejects an email already used by another account', async () => {
    const user = {
      _id: 'user-id',
      email: 'old@example.com',
      save: jest.fn(),
    };
    service.findById = jest.fn().mockResolvedValue(user as never);
    (userModel as any).findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: 'other-user-id' }),
    });

    await expect(
      service.updateProfile('user-id', { email: 'used@example.com' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(user.save).not.toHaveBeenCalled();
  });

  it('increments the token version after changing the password', async () => {
    const user = {
      passwordHash: await bcrypt.hash('old-password', 4),
      tokenVersion: 3,
      save: jest.fn().mockResolvedValue(undefined),
    };
    service.findById = jest.fn().mockResolvedValue(user as never);

    await expect(
      service.changePassword('user-id', {
        oldPassword: 'old-password',
        newPassword: 'new-password',
      }),
    ).resolves.toEqual({ message: 'პაროლი წარმატებით შეიცვალა' });
    expect(user.tokenVersion).toBe(4);
    await expect(bcrypt.compare('new-password', user.passwordHash)).resolves.toBe(true);
    expect(user.save).toHaveBeenCalled();
  });

  it('increments the token version when logging out', async () => {
    const user = {
      tokenVersion: 1,
      save: jest.fn().mockResolvedValue(undefined),
    };
    service.findById = jest.fn().mockResolvedValue(user as never);

    await expect(service.invalidateAccessTokens('user-id')).resolves.toBeUndefined();
    expect(user.tokenVersion).toBe(2);
    expect(user.save).toHaveBeenCalled();
  });
});
