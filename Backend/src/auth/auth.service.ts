import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('ეს ელფოსტა უკვე რეგისტრირებულია');
    }
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    return this.usersService.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash,
    });
  }

  async validateUser(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('არასწორი ელფოსტა ან პაროლი');
    }
    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('არასწორი ელფოსტა ან პაროლი');
    }
    return user;
  }

  async createAuthResponse(userId: string) {
    const user = await this.usersService.findById(userId);
    const accessToken = await this.jwtService.signAsync({
      sub: String(user._id),
      tokenVersion: user.tokenVersion ?? 0,
    });
    return { accessToken, user: this.usersService.toSafeUser(user) };
  }

  async getUserFromAuthorization(authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        tokenVersion?: number;
      }>(token);
      const user = await this.usersService.findById(payload.sub);
      if ((user.tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)) {
        return null;
      }
      return this.usersService.toSafeUser(user);
    } catch {
      return null;
    }
  }

  async logout(userId: string) {
    await this.usersService.invalidateAccessTokens(userId);
    return { message: 'წარმატებით გამოხვედით' };
  }
}
