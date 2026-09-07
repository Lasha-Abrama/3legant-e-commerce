import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const GOOGLE_STATE_COOKIE = 'google_oauth_state';
const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;

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

  createState() {
    return randomBytes(32).toString('base64url');
  }

  createStateCookieValue(state: string) {
    return `${state}.${this.signState(state)}`;
  }

  validateState(state: string | undefined, cookieValue: string | undefined) {
    if (!state || !cookieValue) {
      throw new BadRequestException('Google sign-in session has expired. Please try again.');
    }
    const [cookieState, signature, ...remainder] = cookieValue.split('.');
    if (!cookieState || !signature || remainder.length > 0) {
      throw new BadRequestException('Google sign-in session is invalid. Please try again.');
    }
    const expectedSignature = Buffer.from(this.signState(cookieState));
    const suppliedSignature = Buffer.from(signature);
    const suppliedState = Buffer.from(state);
    const expectedState = Buffer.from(cookieState);
    const signaturesMatch = suppliedSignature.length === expectedSignature.length
      && timingSafeEqual(suppliedSignature, expectedSignature);
    const statesMatch = suppliedState.length === expectedState.length
      && timingSafeEqual(suppliedState, expectedState);
    if (!signaturesMatch || !statesMatch) {
      throw new BadRequestException('Google sign-in session is invalid. Please try again.');
    }
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
