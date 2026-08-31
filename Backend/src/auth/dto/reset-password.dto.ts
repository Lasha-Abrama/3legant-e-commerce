import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(32, { message: 'The reset link is invalid' })
  token: string;

  @IsString()
  @MinLength(8, { message: 'Password must contain at least 8 characters' })
  password: string;
}
