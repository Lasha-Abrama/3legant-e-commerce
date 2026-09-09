import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { Question, QuestionSchema } from './schemas/question.schema';

@Module({ imports: [MongooseModule.forFeature([{ name: Question.name, schema: QuestionSchema }]), ProductsModule, UsersModule], controllers: [QuestionsController], providers: [QuestionsService] })
export class QuestionsModule {}
