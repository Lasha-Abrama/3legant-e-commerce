import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'სახელი სავალდებულოა' })
  firstName: string;

  @IsNotEmpty({ message: 'გვარი სავალდებულოა' })
  lastName: string;

  @IsEmail({}, { message: 'ელფოსტის ფორმატი არასწორია' })
  email: string;

  @MinLength(8, { message: 'პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს' })
  password: string;
}
