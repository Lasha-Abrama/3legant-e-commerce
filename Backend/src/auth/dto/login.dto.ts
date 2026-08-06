import { IsEmail, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'ელფოსტის ფორმატი არასწორია' })
  email: string;

  @IsNotEmpty({ message: 'პაროლი სავალდებულოა' })
  password: string;
}
