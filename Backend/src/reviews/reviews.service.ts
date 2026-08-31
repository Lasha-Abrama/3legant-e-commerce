import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
  ) {}

  findByProduct(productId: string) {
    return this.reviewModel
      .find({ product: productId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async create(productId: string, userId: string, authorName: string, dto: CreateReviewDto) {
    await this.productsService.findOne(productId);
    const hasPurchased = await this.ordersService.hasPurchasedProduct(userId, productId);
    if (!hasPurchased) {
      throw new ForbiddenException('Only customers who purchased this product can review it');
    }
    const existingReview = await this.reviewModel.findOne({
      product: productId,
      user: userId,
    }).exec();
    if (existingReview) {
      throw new ConflictException('You have already reviewed this product');
    }

    let review: ReviewDocument;
    try {
      review = await new this.reviewModel({
        product: new Types.ObjectId(productId),
        user: new Types.ObjectId(userId),
        authorName,
        rating: dto.rating,
        text: dto.text,
      }).save();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new ConflictException('You have already reviewed this product');
      }
      throw error;
    }

    await this.recalculateProductRating(productId);
    return review;
  }

  findAll() {
    return this.reviewModel
      .find()
      .populate('product', 'name')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async remove(reviewId: string) {
    const review = await this.reviewModel.findByIdAndDelete(reviewId).exec();
    if (!review) {
      throw new NotFoundException('შეფასება ვერ მოიძებნა');
    }
    await this.recalculateProductRating(String(review.product));
    return { message: 'წაიშალა' };
  }

  private async recalculateProductRating(productId: string) {
    const stats = await this.reviewModel
      .aggregate<{ _id: null; avg: number; count: number }>([
        { $match: { product: new Types.ObjectId(productId) } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ])
      .exec();
    const { avg = 5, count = 0 } = stats[0] ?? {};
    await this.productsService.recalculateRating(productId, Math.round(avg * 10) / 10, count);
  }
}
