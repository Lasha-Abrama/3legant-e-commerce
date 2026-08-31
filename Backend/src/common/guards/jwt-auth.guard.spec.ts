import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersService } from '../../users/users.service';

describe('JwtAuthGuard', () => {
  const usersService = {
    findById: jest.fn(),
  } as unknown as UsersService;
  const jwtService = {
    verifyAsync: jest.fn(),
  } as unknown as JwtService;
  const guard = new JwtAuthGuard(usersService, jwtService);

  function contextFor(request: Record<string, unknown>) {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('attaches the verified user to the request', async () => {
    const request = { headers: { authorization: 'Bearer valid-token' } } as Record<string, unknown>;
    const user = { _id: 'user-id' };
    jwtService.verifyAsync = jest.fn().mockResolvedValue({ sub: 'user-id' });
    usersService.findById = jest.fn().mockResolvedValue(user);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toBe(user);
  });

  it('rejects missing and invalid tokens', async () => {
    const missingTokenRequest = { headers: {} } as Record<string, unknown>;
    await expect(guard.canActivate(contextFor(missingTokenRequest))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const invalidTokenRequest = {
      headers: { authorization: 'Bearer invalid-token' },
    } as Record<string, unknown>;
    jwtService.verifyAsync = jest.fn().mockRejectedValue(new Error('invalid token'));
    await expect(guard.canActivate(contextFor(invalidTokenRequest))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects tokens issued before a password change', async () => {
    const request = {
      headers: { authorization: 'Bearer stale-token' },
    } as Record<string, unknown>;
    jwtService.verifyAsync = jest.fn().mockResolvedValue({
      sub: 'user-id',
      tokenVersion: 0,
    });
    usersService.findById = jest.fn().mockResolvedValue({
      _id: 'user-id',
      tokenVersion: 1,
    });

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });
});
