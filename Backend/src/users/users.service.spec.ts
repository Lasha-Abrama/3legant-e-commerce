import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const userModel = jest.fn();
  const productModel = {
    exists: jest.fn(),
  };
  const service = new UsersService(userModel as never, productModel as never);

  beforeEach(() => {
    jest.clearAllMocks();
    service.getWishlist = UsersService.prototype.getWishlist.bind(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockPasswordVerification() {
    (jest.spyOn(bcrypt, 'compare') as unknown as jest.SpyInstance<Promise<boolean>, [string, string]>)
      .mockResolvedValue(true);
  }

  it('normalizes a changed email and rotates credentials atomically', async () => {
    const user = {
      _id: 'user-id',
      email: 'old@example.com',
      save: jest.fn(),
    };
    const updatedUser = { _id: 'user-id', email: 'new@example.com' };
    service.findById = jest.fn().mockResolvedValue(user as never);
    (userModel as any).findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ passwordHash: 'existing-hash', tokenVersion: 0 }),
      }),
    });
    (userModel as any).findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    (userModel as any).findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(updatedUser),
    });
    mockPasswordVerification();

    await expect(
      service.updateProfile('user-id', {
        email: '  NEW@Example.com  ',
        currentPassword: 'old-password',
      }),
    ).resolves.toBe(updatedUser);
    expect((userModel as any).findOne).toHaveBeenCalledWith({
      _id: { $ne: 'user-id' },
      email: 'new@example.com',
    });
    expect((userModel as any).findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'user-id' }),
      expect.objectContaining({ $set: expect.objectContaining({ email: 'new@example.com' }), $inc: { tokenVersion: 1 } }),
      { returnDocument: 'after', runValidators: true },
    );
    expect(user.save).not.toHaveBeenCalled();
  });

  it('replaces the authenticated user profile image and preserves the old identifier for cleanup', async () => {
    const user = {
      profileImageUrl: 'https://res.cloudinary.com/test/old.png',
      profileImagePublicId: 'loam-co/profile-images/old-avatar',
      save: jest.fn().mockResolvedValue(undefined),
    };
    (userModel as any).findOneAndUpdate = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(user) }),
    });
    await expect(service.replaceProfileImage('user-id', {
      url: 'https://res.cloudinary.com/test/new.png',
      publicId: 'loam-co/profile-images/new-avatar',
    })).resolves.toEqual({
      user,
      previousPublicId: 'loam-co/profile-images/old-avatar',
    });
    expect(user.profileImageUrl).toBe('https://res.cloudinary.com/test/new.png');
    expect(user.profileImagePublicId).toBe('loam-co/profile-images/new-avatar');
    expect((userModel as any).findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'user-id' },
      { $set: { profileImageUrl: 'https://res.cloudinary.com/test/new.png', profileImagePublicId: 'loam-co/profile-images/new-avatar' } },
      { returnDocument: 'before', runValidators: true },
    );
    expect(user.save).not.toHaveBeenCalled();
  });

  it.each([undefined, 'incorrect-password'])('rejects email changes without valid re-authentication (%p)', async (currentPassword) => {
    service.findById = jest.fn().mockResolvedValue({ _id: 'user-id', email: 'old@example.com' } as never);
    (userModel as any).findById = jest.fn().mockReturnValue({ select: () => ({
      exec: async () => ({ passwordHash: await bcrypt.hash('correct-password', 4) }),
    }) });
    (userModel as any).findOneAndUpdate = jest.fn();
    await expect(service.updateProfile('user-id', { email: 'new@example.com', currentPassword }))
      .rejects.toThrow('current password is required');
    expect((userModel as any).findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns the profile image URL without exposing its Cloudinary public identifier', () => {
    const safeUser = service.toSafeUser({
      _id: 'user-id',
      profileImageUrl: 'https://res.cloudinary.com/test/avatar.png',
      profileImagePublicId: 'loam-co/profile-images/private-id',
    } as never);
    expect(safeUser.profileImageUrl).toBe('https://res.cloudinary.com/test/avatar.png');
    expect(safeUser).not.toHaveProperty('profileImagePublicId');
  });

  it('rejects an email already used by another account', async () => {
    const user = {
      _id: 'user-id',
      email: 'old@example.com',
      save: jest.fn(),
    };
    service.findById = jest.fn().mockResolvedValue(user as never);
    (userModel as any).findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ passwordHash: 'existing-hash', tokenVersion: 0 }),
      }),
    });
    (userModel as any).findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: 'other-user-id' }),
    });
    mockPasswordVerification();

    await expect(
      service.updateProfile('user-id', {
        email: 'used@example.com',
        currentPassword: 'old-password',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(user.save).not.toHaveBeenCalled();
  });

  it('increments the token version after changing the password', async () => {
    const user = {
      passwordHash: await bcrypt.hash('old-password', 4),
      tokenVersion: 3,
      save: jest.fn().mockResolvedValue(undefined),
    };
    (userModel as any).findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(user) }),
    });

    (userModel as any).updateOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ matchedCount: 1 }) });
    await expect(
      service.changePassword('user-id', {
        oldPassword: 'old-password',
        newPassword: 'new-password',
      }),
    ).resolves.toEqual({ message: 'პაროლი წარმატებით შეიცვალა' });
    const [filter, update] = (userModel as any).updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: 'user-id', passwordHash: user.passwordHash });
    expect(update.$inc).toEqual({ tokenVersion: 1 });
    expect(update.$unset).toEqual({ refreshSessions: 1, passwordResetTokenHash: 1, passwordResetExpiresAt: 1 });
    await expect(bcrypt.compare('new-password', update.$set.passwordHash)).resolves.toBe(true);
    expect(user.save).not.toHaveBeenCalled();
  });

  it('does not automatically link an unverified email account to a Google identity', async () => {
    const user = {
      _id: 'user-id',
      email: 'google@example.com',
      googleId: undefined,
      save: jest.fn(),
    };
    user.save.mockResolvedValue(user);
    service.findByGoogleId = jest.fn().mockResolvedValue(null);
    service.findByEmail = jest.fn().mockResolvedValue(user as never);

    await expect(service.findOrCreateGoogleUser({
      googleId: 'google-subject',
      email: 'GOOGLE@example.com',
      firstName: 'Google',
      lastName: 'User',
    })).rejects.toMatchObject({ response: { code: 'GOOGLE_ACCOUNT_EXISTS' } });

    expect(user.googleId).toBeUndefined();
    expect(user.save).not.toHaveBeenCalled();
  });

  it('returns an existing Google account without creating a duplicate', async () => {
    const user = { _id: 'google-user-id', googleId: 'google-subject' };
    service.findByGoogleId = jest.fn().mockResolvedValue(user as never);
    service.findByEmail = jest.fn();

    await expect(service.findOrCreateGoogleUser({
      googleId: 'google-subject',
      email: 'google@example.com',
      firstName: 'Google',
      lastName: 'User',
    })).resolves.toBe(user);

    expect(service.findByEmail).not.toHaveBeenCalled();
  });

  it('atomically increments the token version when logging out', async () => {
    (userModel as any).updateOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ matchedCount: 1 }) });
    await expect(service.invalidateAccessTokens('user-id')).resolves.toBeUndefined();
    expect((userModel as any).updateOne).toHaveBeenCalledWith(
      { _id: 'user-id' },
      { $inc: { tokenVersion: 1 }, $unset: { refreshSessions: 1 } },
    );
  });

  it('stores a normalized password reset token for an existing email', async () => {
    (userModel as any).findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: 'user-id' }),
    });
    const expiresAt = new Date(Date.now() + 60_000);

    await service.setPasswordResetToken('  SOFIA@Example.com ', 'token-hash', expiresAt);

    expect((userModel as any).findOneAndUpdate).toHaveBeenCalledWith(
      { email: 'sofia@example.com' },
      { passwordResetTokenHash: 'token-hash', passwordResetExpiresAt: expiresAt },
      { returnDocument: 'after' },
    );
  });

  it('consumes a reset token atomically so it cannot reset a password twice', async () => {
    const exec = jest.fn().mockResolvedValueOnce({ _id: 'user-id' }).mockResolvedValueOnce(null);
    (userModel as any).findOneAndUpdate = jest.fn().mockReturnValue({ exec });
    await expect(service.resetPasswordWithToken('valid-hash', 'new-hash')).resolves.toBeUndefined();
    expect((userModel as any).findOneAndUpdate).toHaveBeenCalledWith(
      { passwordResetTokenHash: 'valid-hash', passwordResetExpiresAt: { $gt: expect.any(Date) } },
      {
        $set: { passwordHash: 'new-hash' },
        $inc: { tokenVersion: 1 },
        $unset: { refreshSessions: 1, passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
      },
      { returnDocument: 'after', runValidators: true },
    );
    await expect(service.resetPasswordWithToken('valid-hash', 'other-hash')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid or expired password reset token', async () => {
    (userModel as any).findOneAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    await expect(service.resetPasswordWithToken('expired-hash', 'new-hash')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing products before changing a wishlist', async () => {
    productModel.exists = jest.fn().mockResolvedValue(null);
    (userModel as any).updateOne = jest.fn();

    await expect(
      service.addToWishlist('user-id', '507f1f77bcf86cd799439011'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect((userModel as any).updateOne).not.toHaveBeenCalled();
  });

  it('adds an existing product to a valid user wishlist', async () => {
    productModel.exists = jest.fn().mockResolvedValue({ _id: 'product-id' });
    (userModel as any).updateOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    });
    service.getWishlist = jest.fn().mockResolvedValue([{ _id: 'product-id' }] as never);

    await expect(
      service.addToWishlist('user-id', '507f1f77bcf86cd799439011'),
    ).resolves.toEqual([{ _id: 'product-id' }]);
    expect((userModel as any).updateOne).toHaveBeenCalledWith(
      { _id: 'user-id' },
      { $addToSet: { wishlist: expect.anything() } },
    );
  });

  it('rejects wishlist changes for a missing user', async () => {
    productModel.exists = jest.fn().mockResolvedValue({ _id: 'product-id' });
    (userModel as any).updateOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ matchedCount: 0 }),
    });

    await expect(
      service.addToWishlist('missing-user', '507f1f77bcf86cd799439011'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes deleted products from every wishlist', async () => {
    (userModel as any).updateMany = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
    });

    await expect(
      service.removeProductFromWishlists('507f1f77bcf86cd799439011'),
    ).resolves.toBeUndefined();
    expect((userModel as any).updateMany).toHaveBeenCalledWith(
      { wishlist: '507f1f77bcf86cd799439011' },
      { $pull: { wishlist: expect.anything() } },
    );
  });

  it('rejects demoting the final administrator', async () => {
    const admin = {
      isAdmin: true,
      save: jest.fn(),
    };
    service.findById = jest.fn().mockResolvedValue(admin as never);
    (userModel as any).countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });

    await expect(service.setAdmin('admin-id', false)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(admin.save).not.toHaveBeenCalled();
  });

  it('allows demoting an administrator when another remains', async () => {
    const admin = {
      isAdmin: true,
      save: jest.fn().mockResolvedValue(undefined),
      _id: 'admin-id',
    };
    service.findById = jest.fn().mockResolvedValue(admin as never);
    (userModel as any).countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(2),
    });
    service.toSafeUser = jest.fn().mockReturnValue({ id: 'admin-id', isAdmin: false });

    await expect(service.setAdmin('admin-id', false)).resolves.toEqual({
      id: 'admin-id',
      isAdmin: false,
    });
    expect(admin.isAdmin).toBe(false);
    expect(admin.save).toHaveBeenCalled();
  });
});
