import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { CookieOptions, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetEmailService } from './password-reset-email.service';
import { GoogleProfile } from './google-oauth.service';

const SALT_ROUNDS = 10;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_MESSAGE = 'If an account exists for that email, a password reset link has been sent.';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordResetEmailService: PasswordResetEmailService,
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
    if (!user || !user.passwordHash) {
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

  private refreshCookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.configService.get('NODE_ENV') === 'production'
      || this.configService.getOrThrow<string>('FRONTEND_URL').startsWith('https:'),
      sameSite: 'lax', path: '/api/auth' };
  }

  async establishSession(userId: string, response: Response) {
    const user = await this.usersService.findById(userId);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.usersService.addRefreshSession(userId, user.tokenVersion ?? 0, this.hashResetToken(token), expiresAt);
    response.setHeader('Cache-Control', 'no-store');
    response.cookie('threelegant_refresh', token, { ...this.refreshCookieOptions(), expires: expiresAt });
  }

  clearSessionCookie(response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    response.clearCookie('threelegant_refresh', this.refreshCookieOptions());
  }

  validateSessionRequest(request: Request) {
    const origin = request.headers.origin;
    if (request.headers['x-requested-with'] !== 'threelegant'
      || (origin && origin !== new URL(this.configService.getOrThrow<string>('FRONTEND_URL')).origin)
      || request.headers['sec-fetch-site'] === 'cross-site') {
      throw new ForbiddenException('Invalid session request.');
    }
  }

  async refresh(token: string | undefined, response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new UnauthorizedException('Please sign in.');
    const replacement = randomBytes(32).toString('base64url');
    const { user, expiresAt } = await this.usersService.rotateRefreshSession(this.hashResetToken(token), this.hashResetToken(replacement));
    const accessToken = await this.jwtService.signAsync({ sub: String(user._id), tokenVersion: user.tokenVersion ?? 0 });
    response.cookie('threelegant_refresh', replacement, { ...this.refreshCookieOptions(), expires: expiresAt });
    return { accessToken, user: this.usersService.toSafeUser(user) };
  }

  async signInWithGoogle(profile: GoogleProfile) {
    const user = await this.usersService.findOrCreateGoogleUser(profile);
    return this.createAuthResponse(String(user._id));
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
        iat: number;
        exp: number;
      }>(token);
      if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp) || payload.exp - payload.iat > 1800) {
        throw new UnauthorizedException('Please sign in again.');
      }
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

  async requestPasswordReset(email: string) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashResetToken(token);
    const user = await this.usersService.setPasswordResetToken(
      email,
      tokenHash,
      new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    );
    const response: { message: string; developmentResetUrl?: string } = {
      message: PASSWORD_RESET_MESSAGE,
    };
    if (!user) return response;

    const resetUrl = `${this.configService.getOrThrow<string>('FRONTEND_URL')}/reset-password.html?token=${encodeURIComponent(token)}`;
    const delivered = await this.passwordResetEmailService.send(user.email, resetUrl);
    if (!delivered && this.configService.get<string>('NODE_ENV') !== 'production') {
      response.developmentResetUrl = resetUrl;
    }
    return response;
  }

  async resetPassword(token: string, password: string) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await this.usersService.resetPasswordWithToken(this.hashResetToken(token), passwordHash);
    return { message: 'Your password has been reset. You can now sign in.' };
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
