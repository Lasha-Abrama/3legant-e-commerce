import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);
  const trustProxy = configService.get<string>('TRUST_PROXY');
  if (trustProxy) {
    app.set('trust proxy', trustProxy);
  }

  configureApp(app);

  const port = configService.get<string>('PORT', '5000');
  await app.listen(port);
  console.log(`Gita_3_Team_2. სერვერი გაშვებულია: http://localhost:${port}`);
}
bootstrap();
