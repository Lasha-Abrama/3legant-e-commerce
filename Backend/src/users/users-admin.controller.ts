import { BadRequestException, Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { SetAdminRoleDto } from './dto/set-admin-role.dto';
import { AdminGuard } from '../common/guards/admin.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AuthenticatedRequest } from '../common/types/authenticated-request';

@Controller('admin/users')
@UseGuards(AdminGuard)
export class UsersAdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Patch(':id/role')
  setRole(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetAdminRoleDto,
  ) {
    if (String(request.user._id) === id) {
      throw new BadRequestException('საკუთარი ადმინისტრატორის სტატუსის შეცვლა არ შეიძლება');
    }
    return this.usersService.setAdmin(id, dto.isAdmin);
  }
}
