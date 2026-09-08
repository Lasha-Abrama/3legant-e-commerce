import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

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

  @IsString()
  @IsByteLength(0, 72, { message: 'Password must not exceed 72 UTF-8 bytes' })
  @MinLength(8, { message: 'პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს' })
  password: string;
}
