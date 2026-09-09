import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type QuestionDocument = HydratedDocument<Question>;

@Schema({ _id: true, timestamps: true })
export class AnswerReply {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) user: Types.ObjectId;
  @Prop({ required: true, trim: true }) authorName: string;
  @Prop({ required: true, trim: true }) text: string;
}
export const AnswerReplySchema = SchemaFactory.createForClass(AnswerReply);

@Schema({ _id: true, timestamps: true })
export class QuestionAnswer {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) user: Types.ObjectId;
  @Prop({ required: true, trim: true }) authorName: string;
  @Prop({ required: true, trim: true }) text: string;
  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] }) likedBy: Types.ObjectId[];
  @Prop({ type: [AnswerReplySchema], default: [] }) replies: AnswerReply[];
}
export const QuestionAnswerSchema = SchemaFactory.createForClass(QuestionAnswer);

@Schema({ timestamps: true })
export class Question {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true }) product: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) user: Types.ObjectId;
  @Prop({ required: true, trim: true }) authorName: string;
  @Prop({ required: true, trim: true }) text: string;
  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] }) likedBy: Types.ObjectId[];
  @Prop({ type: [QuestionAnswerSchema], default: [] }) answers: QuestionAnswer[];
}
export const QuestionSchema = SchemaFactory.createForClass(Question);
