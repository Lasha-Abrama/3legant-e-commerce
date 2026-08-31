const REQUIRED_VARIABLES = [
  'MONGO_URL',
  'JWT_SECRET',
  'CLOUDINARY_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'FRONTEND_URL',
] as const;

function readRequiredString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Environment validation failed: ${key} is required`);
  }
  return value.trim();
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const validated = { ...config };
  const nodeEnv = typeof config.NODE_ENV === 'string' ? config.NODE_ENV.trim() : 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('Environment validation failed: NODE_ENV is invalid');
  }

  const port = Number(config.PORT ?? 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Environment validation failed: PORT must be an integer from 1 to 65535');
  }

  for (const key of REQUIRED_VARIABLES) {
    validated[key] = readRequiredString(config, key);
  }

  const mongoUrl = validated.MONGO_URL as string;
  if (!/^mongodb(?:\+srv)?:\/\//.test(mongoUrl)) {
    throw new Error('Environment validation failed: MONGO_URL must be a MongoDB connection URL');
  }

  const jwtSecret = validated.JWT_SECRET as string;
  const minimumJwtLength = nodeEnv === 'production' ? 32 : 16;
  if (jwtSecret.length < minimumJwtLength) {
    throw new Error(
      `Environment validation failed: JWT_SECRET must contain at least ${minimumJwtLength} characters`,
    );
  }

  const stripeSecretKey = validated.STRIPE_SECRET_KEY as string;
  if (!stripeSecretKey.startsWith('sk_test_') && !stripeSecretKey.startsWith('sk_live_')) {
    throw new Error('Environment validation failed: STRIPE_SECRET_KEY has an invalid format');
  }

  const stripeWebhookSecret = validated.STRIPE_WEBHOOK_SECRET as string;
  if (!stripeWebhookSecret.startsWith('whsec_')) {
    throw new Error('Environment validation failed: STRIPE_WEBHOOK_SECRET has an invalid format');
  }

  const frontendUrl = validated.FRONTEND_URL as string;
  let parsedFrontendUrl: URL;
  try {
    parsedFrontendUrl = new URL(frontendUrl);
  } catch {
    throw new Error('Environment validation failed: FRONTEND_URL must be a valid URL');
  }
  if (!['http:', 'https:'].includes(parsedFrontendUrl.protocol)) {
    throw new Error('Environment validation failed: FRONTEND_URL must use HTTP or HTTPS');
  }

  const trustProxy = config.TRUST_PROXY;
  if (typeof trustProxy === 'string' && trustProxy.trim()) {
    const normalizedTrustProxy = trustProxy.trim();
    if (normalizedTrustProxy === 'true') {
      throw new Error('Environment validation failed: TRUST_PROXY cannot trust every proxy');
    }
    validated.TRUST_PROXY = /^\d+$/.test(normalizedTrustProxy)
      ? Number(normalizedTrustProxy)
      : normalizedTrustProxy;
  } else {
    delete validated.TRUST_PROXY;
  }

  validated.NODE_ENV = nodeEnv;
  validated.PORT = port;
  validated.FRONTEND_URL = frontendUrl.replace(/\/+$/, '');
  return validated;
}
