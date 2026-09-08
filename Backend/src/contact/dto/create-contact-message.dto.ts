import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateContactMessageDto {
  @IsString()
  @MinLength(1, { message: 'სახელი სავალდებულოა' })
  @MaxLength(100, { message: 'სახელი არ უნდა აღემატებოდეს 100 სიმბოლოს' })
  @Matches(/\S/, { message: 'სახელი სავალდებულოა' })
  name: string;

  @IsEmail({}, { message: 'ელფოსტის ფორმატი არასწორია' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'შეტყობინება არ უნდა იყოს ცარიელი' })
  @MaxLength(5000, { message: 'შეტყობინება არ უნდა აღემატებოდეს 5000 სიმბოლოს' })
  @Matches(/\S/, { message: 'შეტყობინება არ უნდა იყოს ცარიელი' })
  message: string;
}
