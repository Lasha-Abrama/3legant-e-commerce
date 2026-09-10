import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { StrongPassword } from '../../auth/password-policy';

export class ChangePasswordDto {
  @IsString()
  @MaxLength(1024)
  @IsNotEmpty({ message: 'ძველი პაროლი სავალდებულოა' })
  oldPassword: string;

  @StrongPassword()
  newPassword: string;
}
