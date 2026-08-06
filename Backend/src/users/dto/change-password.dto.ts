import { IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'ძველი პაროლი სავალდებულოა' })
  oldPassword: string;

  @MinLength(8, { message: 'ახალი პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს' })
  newPassword: string;
}
