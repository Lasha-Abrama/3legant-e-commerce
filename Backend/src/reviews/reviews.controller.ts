import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AuthenticatedRequest } from '../common/types/authenticated-request';
import { UpdateReviewDto } from './dto/update-review.dto';
import { CreateReviewReplyDto } from './dto/create-review-reply.dto';

@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  findByProduct(@Param('productId', ParseObjectIdPipe) productId: string) {
    return this.reviewsService.findByProduct(productId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateReviewDto,
  ) {
    const authorName = request.user.displayName || `${request.user.firstName} ${request.user.lastName}`;
    return this.reviewsService.create(productId, String(request.user._id), authorName, dto);
  }

  @Patch(':reviewId')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Param('reviewId', ParseObjectIdPipe) reviewId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(productId, reviewId, String(request.user._id), dto);
  }

  @Post(':reviewId/like')
  @UseGuards(JwtAuthGuard)
  toggleLike(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Param('reviewId', ParseObjectIdPipe) reviewId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reviewsService.toggleLike(productId, reviewId, String(request.user._id));
  }

  @Post(':reviewId/replies')
  @UseGuards(JwtAuthGuard)
  reply(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Param('reviewId', ParseObjectIdPipe) reviewId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateReviewReplyDto,
  ) {
    const authorName = request.user.displayName || `${request.user.firstName} ${request.user.lastName}`;
    return this.reviewsService.addReply(productId, reviewId, String(request.user._id), authorName, dto.text, dto.replyToId);
  }
  @Post(':reviewId/replies/:replyId/like')
  @UseGuards(JwtAuthGuard)
  likeReply(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Param('reviewId', ParseObjectIdPipe) reviewId: string,
    @Param('replyId', ParseObjectIdPipe) replyId: string,
    @Req() request: AuthenticatedRequest,
  ) { return this.reviewsService.toggleReplyLike(productId, reviewId, replyId, String(request.user._id)); }

  @Patch(':reviewId/replies/:replyId')
  @UseGuards(JwtAuthGuard)
  editReply(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Param('reviewId', ParseObjectIdPipe) reviewId: string,
    @Param('replyId', ParseObjectIdPipe) replyId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateReviewReplyDto,
  ) { return this.reviewsService.updateReply(productId, reviewId, replyId, String(request.user._id), dto.text); }

}
