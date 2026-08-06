import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'სახელი არ უნდა იყოს ცარიელი' })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'გვარი არ უნდა იყოს ცარიელი' })
  lastName?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'ელფოსტის ფორმატი არასწორია' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
