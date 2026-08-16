import { NestFactory } from '@nestjs/core';
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
  configureApp(app);
  await app.init();
}

export default async function handler(req: any, res: any) {
  if (!bootstrapped) {
    bootstrapped = bootstrap();
  }
  await bootstrapped;
  expressApp(req, res);
}
