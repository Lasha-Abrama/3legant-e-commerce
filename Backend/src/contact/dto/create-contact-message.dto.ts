import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateContactMessageDto {
  @IsString()
  @MinLength(1, { message: 'სახელი სავალდებულოა' })
  name: string;

  @IsEmail({}, { message: 'ელფოსტის ფორმატი არასწორია' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'შეტყობინება არ უნდა იყოს ცარიელი' })
  message: string;
}
