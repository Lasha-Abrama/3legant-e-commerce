import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateReviewReplyDto {
  @IsString()
  @MinLength(1, { message: 'Reply text is required' })
  @Matches(/\S/, { message: 'Reply text is required' })
  @MaxLength(1000, { message: 'A reply cannot exceed 1000 characters' })
  text: string;
}
