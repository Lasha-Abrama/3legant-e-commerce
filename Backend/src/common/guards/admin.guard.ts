import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.session?.userId;
    if (!userId) {
      throw new UnauthorizedException('გაიარეთ ავტორიზაცია');
    }
    const user = await this.usersService.findById(userId);
    if (!user.isAdmin) {
      throw new ForbiddenException('წვდომა აკრძალულია');
    }
    request.user = user;
    return true;
  }
}
