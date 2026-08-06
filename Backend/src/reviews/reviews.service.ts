import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { ProductsService } from '../products/products.service';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    private readonly productsService: ProductsService,
  ) {}

  findByProduct(productId: string) {
    return this.reviewModel
      .find({ product: productId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async create(productId: string, userId: string, authorName: string, dto: CreateReviewDto) {
    const review = await new this.reviewModel({
      product: new Types.ObjectId(productId),
      user: new Types.ObjectId(userId),
      authorName,
      rating: dto.rating,
      text: dto.text,
    }).save();

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
