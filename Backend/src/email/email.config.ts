import { isEmail } from 'class-validator';

export function validateSmtpEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const keys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'] as const;
  const values = Object.fromEntries(keys.map((key) => [key,
    typeof config[key] === 'string' ? config[key] as string : '',
  ]));
  const enabled = keys.some((key) => values[key].trim());
  if (enabled && keys.some((key) => !values[key].trim())) {
    throw new Error('Environment validation failed: SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM must be configured together');
  }
  const port = Number(config.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Environment validation failed: SMTP_PORT must be a valid port');
  }
  const secure = String(config.SMTP_SECURE ?? 'false');
  if (!['true', 'false'].includes(secure)) {
    throw new Error('Environment validation failed: SMTP_SECURE must be true or false');
  }
  if (enabled && (!isEmail(values.SMTP_FROM) || /[\r\n]/.test(values.SMTP_FROM))) {
    throw new Error('Environment validation failed: SMTP_FROM must be a single email address');
  }
  const fromName = typeof config.SMTP_FROM_NAME === 'string' ? config.SMTP_FROM_NAME.trim() : '';
  if (/[\r\n]/.test(fromName)) {
    throw new Error('Environment validation failed: SMTP_FROM_NAME must not contain line breaks');
  }
  return { ...values, SMTP_PORT: port, SMTP_SECURE: secure === 'true', SMTP_FROM_NAME: fromName };
}
