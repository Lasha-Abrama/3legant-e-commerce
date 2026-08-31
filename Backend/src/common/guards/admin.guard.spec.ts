import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminGuard } from './admin.guard';
import { UsersService } from '../../users/users.service';

describe('AdminGuard', () => {
  const usersService = {
    findById: jest.fn(),
  } as unknown as UsersService;
  const jwtService = {
    verifyAsync: jest.fn(),
  } as unknown as JwtService;
  const guard = new AdminGuard(usersService, jwtService);

  function contextFor(request: Record<string, unknown>) {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows a valid administrator', async () => {
    const request = { headers: { authorization: 'Bearer admin-token' } } as Record<string, unknown>;
    const user = { _id: 'admin-id', isAdmin: true, tokenVersion: 2 };
    jwtService.verifyAsync = jest.fn().mockResolvedValue({ sub: 'admin-id', tokenVersion: 2 });
    usersService.findById = jest.fn().mockResolvedValue(user);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toBe(user);
  });

  it('rejects administrator tokens issued before session invalidation', async () => {
    const request = { headers: { authorization: 'Bearer stale-admin-token' } } as Record<string, unknown>;
    jwtService.verifyAsync = jest.fn().mockResolvedValue({ sub: 'admin-id', tokenVersion: 1 });
    usersService.findById = jest.fn().mockResolvedValue({
      _id: 'admin-id',
      isAdmin: true,
      tokenVersion: 2,
    });

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an authenticated non-administrator', async () => {
    const request = { headers: { authorization: 'Bearer user-token' } } as Record<string, unknown>;
    jwtService.verifyAsync = jest.fn().mockResolvedValue({ sub: 'user-id', tokenVersion: 0 });
    usersService.findById = jest.fn().mockResolvedValue({ _id: 'user-id', isAdmin: false });

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects missing and invalid tokens', async () => {
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const request = { headers: { authorization: 'Bearer invalid-token' } } as Record<string, unknown>;
    jwtService.verifyAsync = jest.fn().mockRejectedValue(new Error('invalid token'));
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
