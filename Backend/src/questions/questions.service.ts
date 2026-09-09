import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductsService } from '../products/products.service';
import { Question, QuestionDocument } from './schemas/question.schema';
import { toggleReaction } from '../common/utils/community-reaction';

@Injectable()
export class QuestionsService {
  constructor(@InjectModel(Question.name) private readonly questionModel: Model<QuestionDocument>, private readonly productsService: ProductsService) {}

  private populate(query: ReturnType<Model<QuestionDocument>['findOne']>) {
    return query.populate('user', 'firstName lastName displayName profileImageUrl')
      .populate('answers.user', 'firstName lastName displayName profileImageUrl')
      .populate('answers.replies.user', 'firstName lastName displayName profileImageUrl');
  }

  findByProduct(productId: string) {
    return this.questionModel.find({ product: productId })
      .populate('user', 'firstName lastName displayName profileImageUrl')
      .populate('answers.user', 'firstName lastName displayName profileImageUrl')
      .populate('answers.replies.user', 'firstName lastName displayName profileImageUrl')
      .sort({ createdAt: -1 }).lean().exec();
  }

  async create(productId: string, userId: string, authorName: string, text: string) {
    await this.productsService.findOne(productId);
    return new this.questionModel({ product: new Types.ObjectId(productId), user: new Types.ObjectId(userId), authorName, text }).save();
  }

  async update(productId: string, questionId: string, userId: string, text: string) {
    const result = await this.questionModel.updateOne({ _id: questionId, product: productId, user: userId }, { $set: { text } }, { runValidators: true }).exec();
    if (!result.matchedCount) throw new ForbiddenException('You can only edit your own question on this product');
    return this.findOne(productId, questionId);
  }

  toggleQuestionLike(productId: string, questionId: string, userId: string, dislike = false) {
    return toggleReaction(this.questionModel, productId, questionId, userId, [], dislike, true);
  }

  async addAnswer(productId: string, questionId: string, userId: string, authorName: string, text: string) {
    const result = await this.questionModel.updateOne({ _id: questionId, product: productId },
      { $push: { answers: { user: new Types.ObjectId(userId), authorName, text } } }, { runValidators: true }).exec();
    if (!result.matchedCount) throw new NotFoundException('Question not found');
    return this.findOne(productId, questionId);
  }

  toggleAnswerLike(productId: string, questionId: string, answerId: string, userId: string, dislike = false, replyId?: string) {
    const targets = [{ field: 'answers', id: answerId }, ...(replyId ? [{ field: 'replies', id: replyId }] : [])];
    return toggleReaction(this.questionModel, productId, questionId, userId, targets, dislike, true);
  }

  async updateAnswer(productId: string, questionId: string, answerId: string, userId: string, text: string, replyId?: string) {
    const ownership = replyId ? { replies: { $elemMatch: { _id: replyId, user: userId } } } : { user: userId };
    const path = replyId ? 'answers.$[answer].replies.$[reply]' : 'answers.$[answer]';
    const result = await this.questionModel.updateOne({ _id: questionId, product: productId,
      answers: { $elemMatch: { _id: answerId, ...ownership } },
    }, { $set: { [`${path}.text`]: text, [`${path}.updatedAt`]: new Date() } }, {
      runValidators: true, arrayFilters: [{ 'answer._id': new Types.ObjectId(answerId) },
        ...(replyId ? [{ 'reply._id': new Types.ObjectId(replyId), 'reply.user': new Types.ObjectId(userId) }] : [])],
    }).exec();
    if (!result.matchedCount) throw new ForbiddenException('You can only edit your own answer or reply on this product');
    return this.findOne(productId, questionId);
  }

  async addAnswerReply(productId: string, questionId: string, answerId: string, userId: string, authorName: string, text: string, replyToId?: string) {
    const result = await this.questionModel.updateOne({ _id: questionId, product: productId,
      answers: { $elemMatch: { _id: answerId, ...(replyToId ? { 'replies._id': replyToId } : {}) } },
    }, { $push: { 'answers.$.replies': { user: new Types.ObjectId(userId), authorName, text,
      ...(replyToId ? { replyTo: new Types.ObjectId(replyToId) } : {}),
    } } }, { runValidators: true }).exec();
    if (!result.matchedCount) throw new NotFoundException('Question, answer or reply not found');
    return this.findOne(productId, questionId);
  }

  private async findOne(productId: string, questionId: string) {
    const question = await this.populate(this.questionModel.findOne({ _id: questionId, product: productId })).lean().exec();
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }
}
