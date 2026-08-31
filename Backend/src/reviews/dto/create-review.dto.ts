import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  @Min(1, { message: 'შეფასება უნდა იყოს 1-დან 5-მდე' })
  @Max(5, { message: 'შეფასება უნდა იყოს 1-დან 5-მდე' })
  rating: number;

  @IsString()
  @MinLength(1, { message: 'გთხოვთ დაწეროთ შეფასების ტექსტი' })
  @Matches(/\S/, { message: 'გთხოვთ დაწეროთ შეფასების ტექსტი' })
  @MaxLength(1000, { message: 'შეფასება არ უნდა აღემატებოდეს 1000 სიმბოლოს' })
  text: string;
}
