import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service';
import { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) {
      throw new UnauthorizedException('გაიარეთ ავტორიზაცია');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        tokenVersion?: number;
      }>(token);
      const user = await this.usersService.findById(payload.sub);
      if ((user.tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)) {
        throw new UnauthorizedException('გაიარეთ ავტორიზაცია');
      }
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('გაიარეთ ავტორიზაცია');
    }
  }
}
