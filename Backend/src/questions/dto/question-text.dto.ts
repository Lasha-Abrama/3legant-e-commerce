import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class QuestionTextDto {
  @IsString()
  @MinLength(1, { message: 'Message is required' })
  @Matches(/\S/, { message: 'Message is required' })
  @MaxLength(1000, { message: 'A message cannot exceed 1000 characters' })
  text: string;
}
