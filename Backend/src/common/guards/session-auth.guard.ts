import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.session?.userId;
    if (!userId) {
      throw new UnauthorizedException('გაიარეთ ავტორიზაცია');
    }
    request.user = await this.usersService.findById(userId);
    return true;
  }
}
