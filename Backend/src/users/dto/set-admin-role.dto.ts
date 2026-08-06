import { IsBoolean } from 'class-validator';

export class SetAdminRoleDto {
  @IsBoolean()
  isAdmin: boolean;
}
