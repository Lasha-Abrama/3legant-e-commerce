import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const GOOGLE_STATE_COOKIE = 'google_oauth_state';
const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_SESSION_COOKIE = 'google_oauth_session';
const GOOGLE_SESSION_TTL_MS = 60 * 1000;

export interface GoogleProfile {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class GoogleOAuthService {
  constructor(private readonly configService: ConfigService) {}

  getStateCookieName() {
    return GOOGLE_STATE_COOKIE;
  }

  getSessionCookieName() {
    return GOOGLE_SESSION_COOKIE;
  }

  getStateCookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      maxAge: GOOGLE_STATE_TTL_MS,
      path: '/api/auth/google/callback',
    };
  }

  getStateCookieClearOptions() {
    const { maxAge: _maxAge, ...options } = this.getStateCookieOptions();
    return options;
  }

  getSessionCookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      maxAge: GOOGLE_SESSION_TTL_MS,
      path: '/api/auth/google',
    };
  }

  getSessionCookieClearOptions() {
    const { maxAge: _maxAge, ...options } = this.getSessionCookieOptions();
    return options;
  }

  createState() {
    return randomBytes(32).toString('base64url');
  }

  createStateCookieValue(state: string, returnPath: string) {
    const payload = Buffer.from(JSON.stringify({ state, returnPath, expiresAt: Date.now() + GOOGLE_STATE_TTL_MS })).toString('base64url');
    return `${payload}.${this.signState(payload)}`;
  }

  validateState(state: string | undefined, cookieValue: string | undefined) {
    if (typeof state !== 'string' || !state || typeof cookieValue !== 'string' || !cookieValue) {
      throw new BadRequestException('Google sign-in session has expired. Please try again.');
    }
    const [encodedPayload, signature, ...remainder] = cookieValue.split('.');
    if (!encodedPayload || !signature || remainder.length > 0) {
      throw new BadRequestException('Google sign-in session is invalid. Please try again.');
    }
    const expectedSignature = Buffer.from(this.signState(encodedPayload));
    const suppliedSignature = Buffer.from(signature);
    const signaturesMatch = suppliedSignature.length === expectedSignature.length
      && timingSafeEqual(suppliedSignature, expectedSignature);
    if (!signaturesMatch) {
      throw new BadRequestException('Google sign-in session is invalid. Please try again.');
    }
    let payload: { state?: unknown; returnPath?: unknown; expiresAt?: unknown };
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Google sign-in session is invalid. Please try again.');
    }
    if (typeof payload.state !== 'string' || typeof payload.returnPath !== 'string'
      || typeof payload.expiresAt !== 'number' || !Number.isFinite(payload.expiresAt)
      || payload.expiresAt <= Date.now()) {
      throw new BadRequestException('Google sign-in session is invalid. Please try again.');
    }
    const suppliedState = Buffer.from(state);
    const expectedState = Buffer.from(payload.state);
    const statesMatch = suppliedState.length === expectedState.length
      && timingSafeEqual(suppliedState, expectedState);
    if (!statesMatch) {
      throw new BadRequestException('Google sign-in session is invalid. Please try again.');
    }
    return this.getSafeReturnPath(payload.returnPath);
  }

  getSafeReturnPath(value: string | undefined) {
    if (typeof value !== 'string' || !value || !value.startsWith('/') || value.startsWith('//')) return '/account.html';
    try {
      const frontendUrl = new URL(this.configService.getOrThrow<string>('FRONTEND_URL'));
      const candidate = new URL(value, frontendUrl);
      if (candidate.origin !== frontendUrl.origin) return '/account.html';
      return `${candidate.pathname}${candidate.search}${candidate.hash}`;
    } catch {
      return '/account.html';
    }
  }

  getFrontendCallbackUrl(returnPath: string | undefined, error?: 'cancelled' | 'failed' | 'account_exists' | 'session_expired') {
    const callbackUrl = new URL('/oauth-callback.html', this.configService.getOrThrow<string>('FRONTEND_URL'));
    if (error) {
      callbackUrl.searchParams.set('error', error);
    } else {
      callbackUrl.searchParams.set('next', this.getSafeReturnPath(returnPath));
    }
    return callbackUrl.toString();
  }

  getAuthorizationUrl(state: string) {
    return this.getClient().generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      response_type: 'code',
      scope: ['openid', 'email', 'profile'],
      state,
    });
  }

  async getProfileFromAuthorizationCode(code: string): Promise<GoogleProfile> {
    try {
      const client = this.getClient();
      const { tokens } = await client.getToken(code);
      if (!tokens.id_token) {
        throw new Error('Google did not return an ID token');
      }
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.getRequiredConfig('GOOGLE_OAUTH_CLIENT_ID'),
      });
      const payload = ticket.getPayload();
      const emailVerified = payload?.email_verified === true;
      if (!payload?.sub || !payload.email || !emailVerified) {
        throw new Error('Google account does not provide a verified email');
      }
      const fallbackName = payload.email.split('@')[0] || 'Google user';
      return {
        googleId: payload.sub,
        email: payload.email,
        firstName: payload.given_name?.trim() || fallbackName,
        lastName: payload.family_name?.trim() || 'User',
      };
    } catch {
      throw new UnauthorizedException('Google sign-in failed. Please try again.');
    }
  }

  private getClient() {
    return new OAuth2Client({
      clientId: this.getRequiredConfig('GOOGLE_OAUTH_CLIENT_ID'),
      clientSecret: this.getRequiredConfig('GOOGLE_OAUTH_CLIENT_SECRET'),
      redirectUri: this.getRequiredConfig('GOOGLE_OAUTH_REDIRECT_URI'),
    });
  }

  private signState(state: string) {
    return createHmac('sha256', this.configService.getOrThrow<string>('JWT_SECRET'))
      .update(state)
      .digest('base64url');
  }

  private getRequiredConfig(key: 'GOOGLE_OAUTH_CLIENT_ID' | 'GOOGLE_OAUTH_CLIENT_SECRET' | 'GOOGLE_OAUTH_REDIRECT_URI') {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new ServiceUnavailableException('Google sign-in is not configured.');
    }
    return value;
  }
}
