import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Review, ReviewSchema } from './schemas/review.schema';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsAdminController } from './reviews-admin.controller';
import { UsersModule } from '../users/users.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Review.name, schema: ReviewSchema }]),
    UsersModule,
    ProductsModule,
  ],
  controllers: [ReviewsController, ReviewsAdminController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
