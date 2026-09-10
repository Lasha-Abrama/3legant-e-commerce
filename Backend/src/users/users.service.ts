import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from './schemas/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Product, ProductDocument } from '../products/schemas/product.schema';

const SALT_ROUNDS = 10;

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
}

export interface GoogleUserInput {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface ProfileImageInput {
  url: string;
  publicId: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
  ) {}

  findByEmail(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash')
      .exec();
  }

  async addRefreshSession(userId: string, tokenVersion: number, hash: string, expiresAt: Date) {
    await this.userModel.updateOne({ _id: userId }, {
      $pull: { refreshSessions: { expiresAt: { $lte: new Date() } } },
    }).exec();
    const result = await this.userModel.updateOne({ _id: userId, tokenVersion }, {
      $push: { refreshSessions: { $each: [{ hash, previousHashes: [], expiresAt }], $slice: -10 } },
    }).exec();
    if (result.matchedCount !== 1) throw new UnauthorizedException('Please sign in again.');
  }

  async rotateRefreshSession(hash: string, replacementHash: string) {
    const user = await this.userModel.findOneAndUpdate({
      refreshSessions: { $elemMatch: { hash, expiresAt: { $gt: new Date() }, 'previousHashes.2047': { $exists: false } } },
    }, {
      $set: { 'refreshSessions.$.hash': replacementHash },
      $push: { 'refreshSessions.$.previousHashes': hash },
    }, { new: true }).select('+refreshSessions').exec();
    if (!user) {
      await this.userModel.updateOne({ 'refreshSessions.previousHashes': hash }, {
        $pull: { refreshSessions: { previousHashes: hash } },
      }).exec();
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    const session = user.refreshSessions.find((entry) => entry.hash === replacementHash)!;
    return { user, expiresAt: session.expiresAt };
  }

  findByGoogleId(googleId: string) {
    return this.userModel.findOne({ googleId }).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('მომხმარებელი ვერ მოიძებნა');
    }
    return user;
  }

  async create(input: CreateUserInput) {
    const user = new this.userModel({
      ...input,
      email: input.email.toLowerCase().trim(),
      displayName: `${input.firstName} ${input.lastName}`.trim(),
    });
    try {
      return await user.save();
    } catch (error) {
      this.rethrowDuplicateEmail(error);
    }
  }

  async findOrCreateGoogleUser(input: GoogleUserInput): Promise<UserDocument> {
    const existingGoogleUser = await this.findByGoogleId(input.googleId);
    if (existingGoogleUser) return existingGoogleUser;

    const email = input.email.toLowerCase().trim();
    const existingEmailUser = await this.findByEmail(email);
    if (existingEmailUser) {
      // Email/password registrations do not verify mailbox ownership. Never merge
      // that account into a Google identity using only a matching email address.
      if (existingEmailUser.googleId === input.googleId) return existingEmailUser;
      throw new BadRequestException({
        code: 'GOOGLE_ACCOUNT_EXISTS',
        message: 'This email already has an account. Sign in using its existing sign-in method.',
      });
    }

    const user = new this.userModel({
      googleId: input.googleId,
      email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      displayName: `${input.firstName} ${input.lastName}`.trim(),
    });
    try {
      return await user.save();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        const existingUser = await this.findByGoogleId(input.googleId);
        if (existingUser) return existingUser;
      }
      this.rethrowDuplicateEmail(error);
    }
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.findById(userId);
    const { email, currentPassword, ...profile } = dto;
    if (email !== undefined && email.toLowerCase().trim() !== user.email) {
      const credentials = await this.userModel.findById(userId).select('+passwordHash').exec();
      if (!credentials?.passwordHash) {
        throw new BadRequestException('Use password reset to set a password before changing your email.');
      }
      if (!currentPassword || !await bcrypt.compare(currentPassword, credentials.passwordHash)) {
        throw new BadRequestException('Your current password is required to change your email.');
      }
      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await this.userModel
        .findOne({ _id: { $ne: user._id }, email: normalizedEmail })
        .exec();
      if (existingUser) {
        throw new BadRequestException('ეს ელფოსტა უკვე რეგისტრირებულია');
      }
      try {
        const updated = await this.userModel.findOneAndUpdate(
          { _id: userId, email: user.email, passwordHash: credentials.passwordHash, tokenVersion: credentials.tokenVersion ?? 0 },
          { $set: { ...profile, email: normalizedEmail }, $inc: { tokenVersion: 1 },
            $unset: { refreshSessions: 1, passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } },
          { new: true, runValidators: true },
        ).exec();
        if (!updated) throw new BadRequestException('Credentials changed. Please sign in again.');
        return updated;
      } catch (error) {
        this.rethrowDuplicateEmail(error);
      }
    }
    Object.assign(user, profile);
    try {
      return await user.save();
    } catch (error) {
      this.rethrowDuplicateEmail(error);
    }
  }

  async updateAddress(userId: string, dto: UpdateAddressDto) {
    const user = await this.findById(userId);
    const { type, ...fields } = dto;
    const target = type === 'billing' ? user.billingAddress : user.shippingAddress;
    Object.assign(target, fields);
    user.markModified(type === 'billing' ? 'billingAddress' : 'shippingAddress');
    return user.save();
  }

  async replaceProfileImage(userId: string, image: ProfileImageInput) {
    // Return the actual previous image from the same atomic update that replaces it.
    const user = await this.userModel
      .findOneAndUpdate(
        { _id: userId },
        { $set: { profileImageUrl: image.url, profileImagePublicId: image.publicId } },
        { new: false, runValidators: true },
      )
      .select('+profileImagePublicId')
      .exec();
    if (!user) throw new NotFoundException('მომხმარებელი ვერ მოიძებნა');
    const previousPublicId = user.profileImagePublicId || '';
    user.profileImageUrl = image.url;
    user.profileImagePublicId = image.publicId;
    return { user, previousPublicId };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId).select('+passwordHash').exec();
    if (!user) {
      throw new NotFoundException('მომხმარებელი ვერ მოიძებნა');
    }
    if (!user.passwordHash) {
      throw new BadRequestException('Password sign-in is not enabled for this account. Use password reset to set a password.');
    }
    const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('ძველი პაროლი არასწორია');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    const result = await this.userModel.updateOne(
      { _id: userId, passwordHash: user.passwordHash },
      {
        $set: { passwordHash },
        $inc: { tokenVersion: 1 },
        $unset: { refreshSessions: 1, passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
      },
    ).exec();
    if (result.matchedCount !== 1) throw new BadRequestException('Credentials changed. Sign in again before changing your password.');
    return { message: 'პაროლი წარმატებით შეიცვალა' };
  }

  async invalidateAccessTokens(userId: string) {
    const result = await this.userModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 }, $unset: { refreshSessions: 1 } }).exec();
    if (result.matchedCount !== 1) throw new NotFoundException('მომხმარებელი ვერ მოიძებნა');
  }

  async setPasswordResetToken(email: string, tokenHash: string, expiresAt: Date) {
    return this.userModel
      .findOneAndUpdate(
        { email: email.toLowerCase().trim() },
        { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt },
        { new: true },
      )
      .exec();
  }

  async resetPasswordWithToken(tokenHash: string, passwordHash: string) {
    // Consume the unexpired reset token and rotate credentials in one atomic write.
    const user = await this.userModel
      .findOneAndUpdate(
        { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: new Date() } },
        {
          $set: { passwordHash },
          $inc: { tokenVersion: 1 },
          $unset: { refreshSessions: 1, passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!user) {
      throw new BadRequestException('The reset link is invalid or has expired.');
    }
  }

  async getWishlist(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .populate('wishlist')
      .exec();
    if (!user) {
      throw new NotFoundException('მომხმარებელი ვერ მოიძებნა');
    }
    return user.wishlist.filter(Boolean);
  }

  async addToWishlist(userId: string, productId: string) {
    const productExists = await this.productModel.exists({ _id: productId });
    if (!productExists) {
      throw new NotFoundException('პროდუქტი ვერ მოიძებნა');
    }
    const result = await this.userModel
      .updateOne(
        { _id: userId },
        { $addToSet: { wishlist: new Types.ObjectId(productId) } },
      )
      .exec();
    if (result.matchedCount !== 1) {
      throw new NotFoundException('მომხმარებელი ვერ მოიძებნა');
    }
    return this.getWishlist(userId);
  }

  async removeFromWishlist(userId: string, productId: string) {
    const result = await this.userModel
      .updateOne(
        { _id: userId },
        { $pull: { wishlist: new Types.ObjectId(productId) } },
      )
      .exec();
    if (result.matchedCount !== 1) {
      throw new NotFoundException('მომხმარებელი ვერ მოიძებნა');
    }
    return this.getWishlist(userId);
  }

  async removeProductFromWishlists(productId: string) {
    await this.userModel
      .updateMany(
        { wishlist: productId },
        { $pull: { wishlist: new Types.ObjectId(productId) } },
      )
      .exec();
  }

  async findAll() {
    const users = await this.userModel.find().sort({ createdAt: -1 }).exec();
    return users.map((user) => this.toSafeUser(user));
  }

  async setAdmin(userId: string, isAdmin: boolean) {
    const user = await this.findById(userId);
    if (user.isAdmin && !isAdmin) {
      const adminCount = await this.userModel.countDocuments({ isAdmin: true }).exec();
      if (adminCount <= 1) {
        throw new BadRequestException('ბოლო ადმინისტრატორის გაუქმება არ შეიძლება');
      }
    }
    user.isAdmin = isAdmin;
    await user.save();
    return this.toSafeUser(user);
  }

  toSafeUser(user: UserDocument) {
    return {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      displayName: user.displayName,
      phone: user.phone,
      profileImageUrl: user.profileImageUrl,
      billingAddress: user.billingAddress,
      shippingAddress: user.shippingAddress,
      isAdmin: user.isAdmin,
    };
  }

  private rethrowDuplicateEmail(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      throw new BadRequestException('ეს ელფოსტა უკვე რეგისტრირებულია');
    }
    throw error;
  }
}
