import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

const expressApp = express();
let bootstrapped: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(expressApp),
    { rawBody: true },
  );
  configureApp(app, app.get(ConfigService));
  await app.init();
}

export default async function handler(req: any, res: any) {
  if (!bootstrapped) {
    bootstrapped = bootstrap().catch((error: unknown) => {
      bootstrapped = null;
      throw error;
    });
  }
  await bootstrapped;
  expressApp(req, res);
}
