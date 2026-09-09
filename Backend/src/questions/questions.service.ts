import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductsService } from '../products/products.service';
import { Question, QuestionDocument } from './schemas/question.schema';

@Injectable()
export class QuestionsService {
  constructor(@InjectModel(Question.name) private readonly questionModel: Model<QuestionDocument>, private readonly productsService: ProductsService) {}

  findByProduct(productId: string) { return this.questionModel.find({ product: productId }).populate('user', 'firstName lastName displayName profileImageUrl').populate('answers.user', 'firstName lastName displayName profileImageUrl').populate('answers.replies.user', 'firstName lastName displayName profileImageUrl').sort({ createdAt: -1 }).lean().exec(); }
  async create(productId: string, userId: string, authorName: string, text: string) { await this.productsService.findOne(productId); return new this.questionModel({ product: new Types.ObjectId(productId), user: new Types.ObjectId(userId), authorName, text }).save(); }
  async update(productId: string, questionId: string, userId: string, text: string) { const question = await this.findDocument(productId, questionId); if (String(question.user) !== userId) throw new ForbiddenException('You can only edit your own question'); question.text = text; await question.save(); return this.findOne(productId, questionId); }
  async toggleQuestionLike(productId: string, questionId: string, userId: string) { const question = await this.findDocument(productId, questionId); const liked = this.toggleLikedBy(question.likedBy, userId); await question.save(); return { liked, likesCount: question.likedBy.length }; }
  async addAnswer(productId: string, questionId: string, userId: string, authorName: string, text: string) { const question = await this.findDocument(productId, questionId); question.answers.push({ user: new Types.ObjectId(userId), authorName, text } as never); await question.save(); return this.findOne(productId, questionId); }
  async toggleAnswerLike(productId: string, questionId: string, answerId: string, userId: string) { const question = await this.findDocument(productId, questionId); const answer = (question.answers as any).id(answerId); if (!answer) throw new NotFoundException('Answer not found'); const liked = this.toggleLikedBy(answer.likedBy, userId); await question.save(); return { liked, likesCount: answer.likedBy.length }; }
  async addAnswerReply(productId: string, questionId: string, answerId: string, userId: string, authorName: string, text: string) { const question = await this.findDocument(productId, questionId); const answer = (question.answers as any).id(answerId); if (!answer) throw new NotFoundException('Answer not found'); answer.replies.push({ user: new Types.ObjectId(userId), authorName, text } as never); await question.save(); return this.findOne(productId, questionId); }
  private async findDocument(productId: string, questionId: string) { const question = await this.questionModel.findOne({ _id: questionId, product: productId }).exec(); if (!question) throw new NotFoundException('Question not found'); return question; }
  private async findOne(productId: string, questionId: string) { const question = await this.questionModel.findOne({ _id: questionId, product: productId }).populate('user', 'firstName lastName displayName profileImageUrl').populate('answers.user', 'firstName lastName displayName profileImageUrl').populate('answers.replies.user', 'firstName lastName displayName profileImageUrl').lean().exec(); if (!question) throw new NotFoundException('Question not found'); return question; }
  private toggleLikedBy(likedBy: Types.ObjectId[], userId: string) { const present = likedBy.some((id) => String(id) === userId); if (present) likedBy.splice(0, likedBy.length, ...likedBy.filter((id) => String(id) !== userId)); else likedBy.push(new Types.ObjectId(userId)); return !present; }
}
