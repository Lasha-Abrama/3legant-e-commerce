import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);
  configureApp(app, configService);

  const port = configService.getOrThrow<number>('PORT');
  await app.listen(port);
  console.log(`Gita_3_Team_2. სერვერი გაშვებულია: http://localhost:${port}`);
}
bootstrap();
