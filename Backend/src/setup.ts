import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';

// Loaded via require() to match this repo's existing Express/connect-mongo
// integration pattern and avoid CJS/ESM default-export interop pitfalls.
const session = require('express-session');
const { default: MongoStore } = require('connect-mongo');

export function configureApp(app: NestExpressApplication): void {
  const configService = app.get(ConfigService);

  // Needed so Express trusts Vercel's proxy and reports the request as
  // secure, otherwise a "secure" session cookie would never get set.
  app.set('trust proxy', 1);

  const mongoUrl = configService.get<string>('MONGO_URL');
  const sessionSecret = configService.get<string>('SESSION_SECRET', 'e-commerce-dev-secret');
  // VERCEL_ENV is set automatically by Vercel (no config needed); fall back
  // to NODE_ENV for non-Vercel production deployments.
  const isProduction =
    configService.get<string>('VERCEL_ENV') === 'production' ||
    configService.get<string>('NODE_ENV') === 'production';

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl }),
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');
}
