import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateContactMessageDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1, { message: 'სახელი სავალდებულოა' })
  @MaxLength(100, { message: 'სახელი არ უნდა აღემატებოდეს 100 სიმბოლოს' })
  @Matches(/\S/, { message: 'სახელი სავალდებულოა' })
  name: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsEmail({}, { message: 'ელფოსტის ფორმატი არასწორია' })
  @MaxLength(254, { message: 'ელფოსტა არ უნდა აღემატებოდეს 254 სიმბოლოს' })
  email: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1, { message: 'შეტყობინება არ უნდა იყოს ცარიელი' })
  @MaxLength(5000, { message: 'შეტყობინება არ უნდა აღემატებოდეს 5000 სიმბოლოს' })
  @Matches(/\S/, { message: 'შეტყობინება არ უნდა იყოს ცარიელი' })
  message: string;
}
