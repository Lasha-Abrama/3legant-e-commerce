import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

// Loaded via require() to match this repo's existing Express/connect-mongo
// integration pattern (see Project1/Back/server.js) and avoid CJS/ESM
// default-export interop pitfalls.
const session = require('express-session');
const { default: MongoStore } = require('connect-mongo');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const mongoUrl = configService.get<string>('MONGO_URL');
  const sessionSecret = configService.get<string>('SESSION_SECRET', 'e-commerce-dev-secret');

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl }),
      cookie: {
        httpOnly: true,
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

  const port = configService.get<string>('PORT', '5000');
  await app.listen(port);
  console.log(`Loam & Co. სერვერი გაშვებულია: http://localhost:${port}`);
}
bootstrap();
