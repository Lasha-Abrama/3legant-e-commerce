import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
  ) {}

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
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

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.findById(userId);
    const { email, ...profile } = dto;
    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await this.userModel
        .findOne({ _id: { $ne: user._id }, email: normalizedEmail })
        .exec();
      if (existingUser) {
        throw new BadRequestException('ეს ელფოსტა უკვე რეგისტრირებულია');
      }
      user.email = normalizedEmail;
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

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.findById(userId);
    const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('ძველი პაროლი არასწორია');
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    return { message: 'პაროლი წარმატებით შეიცვალა' };
  }

  async invalidateAccessTokens(userId: string) {
    const user = await this.findById(userId);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
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
