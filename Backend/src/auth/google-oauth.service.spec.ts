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
    getOrThrow: jest.fn(() => 'test-jwt-secret'),
  } as unknown as ConfigService;
  const service = new GoogleOAuthService(configService);

  it('creates and verifies a signed short-lived OAuth state cookie', () => {
    const state = service.createState();
    const cookieValue = service.createStateCookieValue(state);

    expect(state).toHaveLength(43);
    expect(cookieValue).toContain(`${state}.`);
    expect(() => service.validateState(state, cookieValue)).not.toThrow();
  });

  it('rejects mismatched or unsigned OAuth state values', () => {
    const state = service.createState();

    expect(() => service.validateState('different-state', service.createStateCookieValue(state)))
      .toThrow(BadRequestException);
    expect(() => service.validateState(state, `${state}.invalid`))
      .toThrow(BadRequestException);
    expect(() => service.validateState(state, '\u{1f600}.invalid'))
      .toThrow(BadRequestException);
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
});
