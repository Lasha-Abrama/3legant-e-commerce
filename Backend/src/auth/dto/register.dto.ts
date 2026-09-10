import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { StrongPassword } from '../password-policy';

export class RegisterDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  @IsNotEmpty({ message: 'სახელი სავალდებულოა' })
  firstName: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  @IsNotEmpty({ message: 'გვარი სავალდებულოა' })
  lastName: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @MaxLength(254)
  @IsEmail({}, { message: 'ელფოსტის ფორმატი არასწორია' })
  email: string;

  @StrongPassword()
  password: string;
}
