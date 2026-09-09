import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AuthenticatedRequest } from '../common/types/authenticated-request';
import { AnswerReplyDto, QuestionTextDto } from './dto/question-text.dto';
import { QuestionsService } from './questions.service';

@Controller('products/:productId/questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}
  @Get() findByProduct(@Param('productId', ParseObjectIdPipe) productId: string) { return this.questionsService.findByProduct(productId); }
  @Post() @UseGuards(JwtAuthGuard) create(@Param('productId', ParseObjectIdPipe) productId: string, @Req() request: AuthenticatedRequest, @Body() dto: QuestionTextDto) { return this.questionsService.create(productId, String(request.user._id), this.authorName(request), dto.text); }
  @Patch(':questionId') @UseGuards(JwtAuthGuard) update(@Param('productId', ParseObjectIdPipe) productId: string, @Param('questionId', ParseObjectIdPipe) questionId: string, @Req() request: AuthenticatedRequest, @Body() dto: QuestionTextDto) { return this.questionsService.update(productId, questionId, String(request.user._id), dto.text); }
  @Post(':questionId/like') @UseGuards(JwtAuthGuard) like(@Param('productId', ParseObjectIdPipe) productId: string, @Param('questionId', ParseObjectIdPipe) questionId: string, @Req() request: AuthenticatedRequest) { return this.questionsService.toggleQuestionLike(productId, questionId, String(request.user._id)); }
  @Post(':questionId/answers') @UseGuards(JwtAuthGuard) answer(@Param('productId', ParseObjectIdPipe) productId: string, @Param('questionId', ParseObjectIdPipe) questionId: string, @Req() request: AuthenticatedRequest, @Body() dto: QuestionTextDto) { return this.questionsService.addAnswer(productId, questionId, String(request.user._id), this.authorName(request), dto.text); }
  @Post(':questionId/answers/:answerId/like') @UseGuards(JwtAuthGuard) likeAnswer(@Param('productId', ParseObjectIdPipe) productId: string, @Param('questionId', ParseObjectIdPipe) questionId: string, @Param('answerId', ParseObjectIdPipe) answerId: string, @Req() request: AuthenticatedRequest) { return this.questionsService.toggleAnswerLike(productId, questionId, answerId, String(request.user._id)); }
  @Post(':questionId/answers/:answerId/replies') @UseGuards(JwtAuthGuard) replyToAnswer(@Param('productId', ParseObjectIdPipe) productId: string, @Param('questionId', ParseObjectIdPipe) questionId: string, @Param('answerId', ParseObjectIdPipe) answerId: string, @Req() request: AuthenticatedRequest, @Body() dto: AnswerReplyDto) { return this.questionsService.addAnswerReply(productId, questionId, answerId, String(request.user._id), this.authorName(request), dto.text, dto.replyToId); }
  @Post(':questionId/dislike')
  @UseGuards(JwtAuthGuard)
  dislike(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Param('questionId', ParseObjectIdPipe) questionId: string,
    @Req() request: AuthenticatedRequest
  ) { return this.questionsService.toggleQuestionLike(productId, questionId, String(request.user._id), true); }

  @Post(':questionId/answers/:answerId/dislike')
  @UseGuards(JwtAuthGuard)
  dislikeAnswer(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Param('questionId', ParseObjectIdPipe) questionId: string,
    @Param('answerId', ParseObjectIdPipe) answerId: string,
    @Req() request: AuthenticatedRequest
  ) { return this.questionsService.toggleAnswerLike(productId, questionId, answerId, String(request.user._id), true); }

  @Patch(':questionId/answers/:answerId')
  @UseGuards(JwtAuthGuard)
  editAnswer(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Param('questionId', ParseObjectIdPipe) questionId: string,
    @Param('answerId', ParseObjectIdPipe) answerId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: QuestionTextDto
  ) { return this.questionsService.updateAnswer(productId, questionId, answerId, String(request.user._id), dto.text); }

  @Patch(':questionId/answers/:answerId/replies/:replyId')
  @UseGuards(JwtAuthGuard)
  editReply(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Param('questionId', ParseObjectIdPipe) questionId: string,
    @Param('answerId', ParseObjectIdPipe) answerId: string,
    @Param('replyId', ParseObjectIdPipe) replyId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: QuestionTextDto
  ) { return this.questionsService.updateAnswer(productId, questionId, answerId, String(request.user._id), dto.text, replyId); }

  @Post(':questionId/answers/:answerId/replies/:replyId/like')
  @UseGuards(JwtAuthGuard)
  likeReply(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Param('questionId', ParseObjectIdPipe) questionId: string,
    @Param('answerId', ParseObjectIdPipe) answerId: string,
    @Param('replyId', ParseObjectIdPipe) replyId: string,
    @Req() request: AuthenticatedRequest
  ) { return this.questionsService.toggleAnswerLike(productId, questionId, answerId, String(request.user._id), false, replyId); }

  @Post(':questionId/answers/:answerId/replies/:replyId/dislike')
  @UseGuards(JwtAuthGuard)
  dislikeReply(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @Param('questionId', ParseObjectIdPipe) questionId: string,
    @Param('answerId', ParseObjectIdPipe) answerId: string,
    @Param('replyId', ParseObjectIdPipe) replyId: string,
    @Req() request: AuthenticatedRequest
  ) { return this.questionsService.toggleAnswerLike(productId, questionId, answerId, String(request.user._id), true, replyId); }

  private authorName(request: AuthenticatedRequest) { return request.user.displayName || `${request.user.firstName} ${request.user.lastName}`; }
}
