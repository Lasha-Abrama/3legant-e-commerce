import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AuthenticatedRequest } from '../common/types/authenticated-request';
import { QuestionTextDto } from './dto/question-text.dto';
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
  @Post(':questionId/answers/:answerId/replies') @UseGuards(JwtAuthGuard) replyToAnswer(@Param('productId', ParseObjectIdPipe) productId: string, @Param('questionId', ParseObjectIdPipe) questionId: string, @Param('answerId', ParseObjectIdPipe) answerId: string, @Req() request: AuthenticatedRequest, @Body() dto: QuestionTextDto) { return this.questionsService.addAnswerReply(productId, questionId, answerId, String(request.user._id), this.authorName(request), dto.text); }
  private authorName(request: AuthenticatedRequest) { return request.user.displayName || `${request.user.firstName} ${request.user.lastName}`; }
}
