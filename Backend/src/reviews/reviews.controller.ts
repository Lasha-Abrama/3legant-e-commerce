import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AuthenticatedRequest } from '../common/types/authenticated-request';

@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  findByProduct(@Param('productId', ParseObjectIdPipe) productId: string) {
    return this.reviewsService.findByProduct(productId);
  }

  @Post()
  @UseGuards(SessionAuthGuard)
  create(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateReviewDto,
  ) {
    const authorName = request.user.displayName || `${request.user.firstName} ${request.user.lastName}`;
    return this.reviewsService.create(productId, String(request.user._id), authorName, dto);
  }
}
