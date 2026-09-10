import { IsString, MaxLength, MinLength } from 'class-validator';
import { StrongPassword } from '../password-policy';

export class ResetPasswordDto {
  @IsString()
  @MaxLength(128)
  @MinLength(32, { message: 'The reset link is invalid' })
  token: string;

  @StrongPassword()
  password: string;
}
