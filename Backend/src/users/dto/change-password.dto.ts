import { IsByteLength, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MaxLength(1024)
  @IsNotEmpty({ message: 'ძველი პაროლი სავალდებულოა' })
  oldPassword: string;

  @IsString()
  @IsByteLength(0, 72, { message: 'Password must not exceed 72 UTF-8 bytes' })
  @MinLength(8, { message: 'ახალი პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს' })
  newPassword: string;
}
