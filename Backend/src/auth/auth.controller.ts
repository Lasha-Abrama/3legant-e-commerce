import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Logger, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/types/authenticated-request';
import { Request, Response } from 'express';
import { GoogleOAuthService } from './google-oauth.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return this.authService.createAuthResponse(String(user._id));
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } })
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto);
    return this.authService.createAuthResponse(String(user._id));
  }

  @Get('google')
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  googleLogin(@Query('next') next: string | undefined, @Res() response: Response) {
    const state = this.googleOAuthService.createState();
    const returnPath = this.googleOAuthService.getSafeReturnPath(next);
    response.cookie(
      this.googleOAuthService.getStateCookieName(),
      this.googleOAuthService.createStateCookieValue(state, returnPath),
      this.googleOAuthService.getStateCookieOptions(),
    );
    return response.redirect(this.googleOAuthService.getAuthorizationUrl(state));
  }

  @Get('google/callback')
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    response.clearCookie(
      this.googleOAuthService.getStateCookieName(),
      this.googleOAuthService.getStateCookieClearOptions(),
    );
    if (error) {
      return response.redirect(this.googleOAuthService.getFrontendCallbackUrl(undefined, 'cancelled'));
    }
    if (!code) {
      return response.redirect(this.googleOAuthService.getFrontendCallbackUrl(undefined, 'failed'));
    }
    let stage = 'state';
    try {
      const returnPath = this.googleOAuthService.validateState(
        state,
        this.getCookieValue(request.headers.cookie, this.googleOAuthService.getStateCookieName()),
      );
      stage = 'google_profile';
      const profile = await this.googleOAuthService.getProfileFromAuthorizationCode(code);
      stage = 'account';
      const authResponse = await this.authService.signInWithGoogle(profile);
      response.cookie(
        this.googleOAuthService.getSessionCookieName(),
        authResponse.accessToken,
        this.googleOAuthService.getSessionCookieOptions(),
      );
      return response.redirect(this.googleOAuthService.getFrontendCallbackUrl(returnPath));
    } catch (failure) {
      const details = failure instanceof BadRequestException ? failure.getResponse() : null;
      const accountExists = stage === 'account' && typeof details === 'object' && details !== null
        && 'code' in details && details.code === 'GOOGLE_ACCOUNT_EXISTS';
      const reason = accountExists ? 'account_exists'
        : stage === 'state' && failure instanceof BadRequestException ? 'session_expired' : 'failed';
      // Do not log OAuth codes, cookies, tokens, emails or raw provider errors.
      this.logger.warn(`Google sign-in failed: stage=${stage}, reason=${reason}`);
      return response.redirect(this.googleOAuthService.getFrontendCallbackUrl(undefined, reason));
    }
  }

  @Get('google/session')
  async googleSession(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const cookieName = this.googleOAuthService.getSessionCookieName();
    const accessToken = this.getCookieValue(request.headers.cookie, cookieName);
    response.clearCookie(cookieName, this.googleOAuthService.getSessionCookieClearOptions());
    if (!accessToken) {
      throw new BadRequestException('Google sign-in session has expired. Please try again.');
    }
    const user = await this.authService.getUserFromAuthorization(`Bearer ${accessToken}`);
    if (!user) {
      throw new BadRequestException('Google sign-in session has expired. Please try again.');
    }
    return { accessToken, user };
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(String(request.user._id));
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    return { user: await this.authService.getUserFromAuthorization(authorization) };
  }

  private getCookieValue(cookieHeader: string | undefined, name: string) {
    if (!cookieHeader) return undefined;
    const prefix = `${name}=`;
    const cookie = cookieHeader.split(';').map((value) => value.trim()).find((value) => value.startsWith(prefix));
    if (!cookie) return undefined;
    try {
      return decodeURIComponent(cookie.slice(prefix.length));
    } catch {
      return undefined;
    }
  }
}
