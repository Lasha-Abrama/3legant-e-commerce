import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  const usersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    toSafeUser: jest.fn(),
  } as unknown as UsersService;
  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as unknown as JwtService;
  const service = new AuthService(usersService, jwtService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a user with a hashed password', async () => {
    const createdUser = { _id: 'user-id' };
    usersService.findByEmail = jest.fn().mockResolvedValue(null);
    usersService.create = jest.fn().mockResolvedValue(createdUser);
    usersService.findById = jest.fn().mockResolvedValue(createdUser);
    usersService.toSafeUser = jest.fn().mockReturnValue({ id: 'user-id' });
    jwtService.signAsync = jest.fn().mockResolvedValue('access-token');

    const response = await service.register({
      firstName: 'Sofia',
      lastName: 'Havertz',
      email: 'SOFIA@example.com',
      password: 'password123',
    });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'SOFIA@example.com',
        passwordHash: expect.any(String),
      }),
    );
    expect((usersService.create as jest.Mock).mock.calls[0][0].passwordHash).not.toBe('password123');
    expect(response).toEqual({ _id: 'user-id' });
  });

  it('rejects duplicate email registration', async () => {
    usersService.findByEmail = jest.fn().mockResolvedValue({ _id: 'existing-user' });

    await expect(
      service.register({
        firstName: 'Sofia',
        lastName: 'Havertz',
        email: 'sofia@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('issues a JWT after validating credentials', async () => {
    const user = { _id: 'user-id', passwordHash: '$2b$10$abcdefghijklmnopqrstuu' };
    usersService.findByEmail = jest.fn().mockResolvedValue(user);
    usersService.findById = jest.fn().mockResolvedValue(user);
    usersService.toSafeUser = jest.fn().mockReturnValue({ id: 'user-id' });
    jwtService.signAsync = jest.fn().mockResolvedValue('access-token');

    const response = await service.createAuthResponse('user-id');

    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-id' });
    expect(response).toEqual({ accessToken: 'access-token', user: { id: 'user-id' } });
  });

  it('returns no user for a missing or invalid authorization header', async () => {
    expect(await service.getUserFromAuthorization()).toBeNull();

    jwtService.verifyAsync = jest.fn().mockRejectedValue(new Error('invalid token'));
    expect(await service.getUserFromAuthorization('Bearer invalid-token')).toBeNull();
  });
});
