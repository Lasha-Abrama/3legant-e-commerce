import { OAuth2Client } from 'google-auth-library';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthService } from './google-oauth.service';

describe('GoogleOAuthService', () => {
  const configService = {
    get: jest.fn((key: string) => ({
      NODE_ENV: 'development',
      GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
      GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
      GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:5000/api/auth/google/callback',
    }[key])),
    getOrThrow: jest.fn((key: string) => key === 'JWT_SECRET'
      ? 'test-jwt-secret'
      : 'http://localhost:5000'),
  } as unknown as ConfigService;
  const service = new GoogleOAuthService(configService);

  it('creates and verifies a signed short-lived OAuth state cookie', () => {
    const state = service.createState();
    const cookieValue = service.createStateCookieValue(state, '/checkout.html');

    expect(state).toHaveLength(43);
    expect(cookieValue).toContain('.');
    expect(service.validateState(state, cookieValue)).toBe('/checkout.html');
  });

  it('rejects mismatched or unsigned OAuth state values', () => {
    const state = service.createState();

    expect(() => service.validateState('different-state', service.createStateCookieValue(state, '/account.html')))
      .toThrow(BadRequestException);
    expect(() => service.validateState(state, 'encoded.invalid'))
      .toThrow(BadRequestException);
    expect(() => service.validateState(state, '\u{1f600}.invalid'))
      .toThrow(BadRequestException);
  });

  it('allows only same-origin local return paths', () => {
    expect(service.getSafeReturnPath('/checkout.html?step=2')).toBe('/checkout.html?step=2');
    expect(service.getSafeReturnPath('https://attacker.example')).toBe('/account.html');
    expect(service.getSafeReturnPath('//attacker.example')).toBe('/account.html');
  });

  it('creates an authorization-code URL with the minimal identity scopes', () => {
    const url = new URL(service.getAuthorizationUrl('oauth-state'));

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('oauth-state');
    expect(url.searchParams.get('scope')).toContain('openid');
    expect(url.searchParams.get('scope')).toContain('email');
    expect(url.searchParams.get('scope')).toContain('profile');
  });
  it('rejects expired signed state even if a client retains the cookie', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      const state = service.createState();
      const cookie = service.createStateCookieValue(state, '/account.html');
      now.mockReturnValue(601001);
      expect(() => service.validateState(state, cookie)).toThrow(BadRequestException);
    } finally { now.mockRestore(); }
  });

  it('handles repeated query parameters without a server error', () => {
    expect(service.getSafeReturnPath(['bad'] as never)).toBe('/account.html');
    expect(() => service.validateState(['bad'] as never, 'cookie')).toThrow(BadRequestException);
  });

  it('verifies Google ID tokens for the configured audience before accepting a profile', async () => {
    const exchange = jest.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({ tokens: { id_token: 'identity-token' } } as never);
    const verify = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({ getPayload: () => ({ sub: 'google-sub', email: 'user@gmail.com', email_verified: true, given_name: 'Test', family_name: 'User' }) } as never);
    try {
      await expect(service.getProfileFromAuthorizationCode('code')).resolves.toMatchObject({ googleId: 'google-sub', email: 'user@gmail.com' });
      expect(verify).toHaveBeenCalledWith({ idToken: 'identity-token', audience: 'google-client-id' });
    } finally { exchange.mockRestore(); verify.mockRestore(); }
  });

  it('rejects unverified Google email claims', async () => {
    const exchange = jest.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({ tokens: { id_token: 'identity-token' } } as never);
    const verify = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({ getPayload: () => ({ sub: 'google-sub', email: 'user@gmail.com', email_verified: false }) } as never);
    try { await expect(service.getProfileFromAuthorizationCode('code')).rejects.toThrow('Google sign-in failed'); }
    finally { exchange.mockRestore(); verify.mockRestore(); }
  });

});
