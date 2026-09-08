import { Transform } from 'class-transformer';
import { IsEmail, ValidateIf, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  @MinLength(1, { message: 'სახელი არ უნდა იყოს ცარიელი' })
  firstName?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  @MinLength(1, { message: 'გვარი არ უნდა იყოს ცარიელი' })
  lastName?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @MaxLength(254)
  @IsEmail({}, { message: 'ელფოსტის ფორმატი არასწორია' })
  email?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  phone?: string;
}
