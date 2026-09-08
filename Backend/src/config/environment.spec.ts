import { validateEnvironment } from './environment';

const validEnvironment = {
  NODE_ENV: 'development',
  PORT: '5000',
  MONGO_URL: 'mongodb://127.0.0.1:27017/e-commerce',
  JWT_SECRET: 'development-secret-value',
  CLOUDINARY_NAME: 'cloud-name',
  CLOUDINARY_API_KEY: 'cloud-key',
  CLOUDINARY_API_SECRET: 'cloud-secret',
  STRIPE_SECRET_KEY: 'sk_test_example',
  STRIPE_WEBHOOK_SECRET: 'whsec_example',
  FRONTEND_URL: 'http://localhost:5000/',
};

describe('validateEnvironment', () => {
  it('normalizes valid configuration', () => {
    expect(validateEnvironment({ ...validEnvironment, TRUST_PROXY: ' 2 ' })).toMatchObject({
      NODE_ENV: 'development',
      PORT: 5000,
      FRONTEND_URL: 'http://localhost:5000',
      TRUST_PROXY: 2,
    });
  });

  it('rejects trusting every reverse proxy', () => {
    expect(() => validateEnvironment({ ...validEnvironment, TRUST_PROXY: 'true' })).toThrow(
      'Environment validation failed: TRUST_PROXY cannot trust every proxy',
    );
  });

  it('rejects missing required variables without exposing values', () => {
    const config = { ...validEnvironment, STRIPE_SECRET_KEY: '' };

    expect(() => validateEnvironment(config)).toThrow(
      'Environment validation failed: STRIPE_SECRET_KEY is required',
    );
  });

  it('rejects invalid ports and frontend URLs', () => {
    expect(() => validateEnvironment({ ...validEnvironment, PORT: '70000' })).toThrow(
      'Environment validation failed: PORT must be an integer from 1 to 65535',
    );
    expect(() =>
      validateEnvironment({ ...validEnvironment, FRONTEND_URL: 'javascript:alert(1)' }),
    ).toThrow('Environment validation failed: FRONTEND_URL must use HTTP or HTTPS');
  });

  it('requires a stronger JWT secret in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        JWT_SECRET: 'short-production-secret',
      }),
    ).toThrow('Environment validation failed: JWT_SECRET must contain at least 32 characters');
  });

  it('allows production to run without password reset email delivery', () => {
    expect(validateEnvironment({
      ...validEnvironment,
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://store.example',
      JWT_SECRET: 'a-production-secret-with-32-characters',
    })).toMatchObject({
      RESEND_API_KEY: '',
      EMAIL_FROM: '',
    });
  });

  it('requires password reset email settings to be configured together', () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      RESEND_API_KEY: 're_example',
    })).toThrow('Environment validation failed: RESEND_API_KEY and EMAIL_FROM must be configured together');
  });

  it('accepts valid password reset email configuration', () => {
    expect(validateEnvironment({
      ...validEnvironment,
      RESEND_API_KEY: 're_example',
      EMAIL_FROM: 'Store <noreply@example.com>',
    })).toMatchObject({
      RESEND_API_KEY: 're_example',
      EMAIL_FROM: 'Store <noreply@example.com>',
    });
  });

  it('requires Google OAuth settings to be configured together', () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      GOOGLE_OAUTH_CLIENT_ID: 'client-id',
    })).toThrow(
      'Environment validation failed: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI must be configured together',
    );
  });

  it('accepts a complete Google OAuth configuration', () => {
    expect(validateEnvironment({
      ...validEnvironment,
      GOOGLE_OAUTH_CLIENT_ID: 'client-id',
      GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
      GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:5000/api/auth/google/callback',
    })).toMatchObject({
      GOOGLE_OAUTH_CLIENT_ID: 'client-id',
      GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
      GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:5000/api/auth/google/callback',
    });
  });
  it('rejects production HTTP and mismatched Google callback origins', () => {
    expect(() => validateEnvironment({ ...validEnvironment, NODE_ENV: 'production', JWT_SECRET: 'a-production-secret-with-32-characters' })).toThrow('must use HTTPS');
    for (const redirect of ['ftp://localhost/api/auth/google/callback', 'http://localhost:5001/api/auth/google/callback', 'http://localhost:5000/other']) {
      expect(() => validateEnvironment({ ...validEnvironment, GOOGLE_OAUTH_CLIENT_ID: 'client', GOOGLE_OAUTH_CLIENT_SECRET: 'secret', GOOGLE_OAUTH_REDIRECT_URI: redirect })).toThrow();
    }
  });

});
