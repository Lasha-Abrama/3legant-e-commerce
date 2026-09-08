import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @MaxLength(254)
  @IsEmail({}, { message: 'ელფოსტის ფორმატი არასწორია' })
  email: string;

  @IsString()
  @MaxLength(1024)
  @IsNotEmpty({ message: 'პაროლი სავალდებულოა' })
  password: string;
}
