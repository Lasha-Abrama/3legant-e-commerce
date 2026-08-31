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
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 5000,
      FRONTEND_URL: 'http://localhost:5000',
    });
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
});
