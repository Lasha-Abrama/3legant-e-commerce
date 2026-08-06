import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

// Vercel keeps warm serverless instances alive between requests, so we
// build the Nest app once per instance and reuse it (and its Mongo
// connection/session store) instead of re-bootstrapping on every call.
const expressApp = express();
let bootstrapped: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(expressApp),
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
