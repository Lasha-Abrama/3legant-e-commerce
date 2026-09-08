import { IsByteLength, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MaxLength(128)
  @MinLength(32, { message: 'The reset link is invalid' })
  token: string;

  @IsString()
  @IsByteLength(0, 72, { message: 'Password must not exceed 72 UTF-8 bytes' })
  @MinLength(8, { message: 'Password must contain at least 8 characters' })
  password: string;
}
