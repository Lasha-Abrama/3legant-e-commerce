import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { MongoThrottlerStorage } from './common/mongo-throttler.storage';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { existsSync } from 'fs';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { BlogsModule } from './blogs/blogs.module';
import { ReviewsModule } from './reviews/reviews.module';
import { OrdersModule } from './orders/orders.module';
import { ContactModule } from './contact/contact.module';
import { UploadsModule } from './uploads/uploads.module';
import { PaymentsModule } from './payments/payments.module';
import { validateEnvironment } from './config/environment';
import { HealthController } from './health.controller';
import { EmailModule } from './email/email.module';
import { QuestionsModule } from './questions/questions.module';

const frontendRootPath = [
  join(__dirname, '..', '..', 'Frontend'),
  join(process.cwd(), 'Frontend'),
  join(process.cwd(), '..', 'Frontend'),
].find(existsSync) || join(__dirname, '..', '..', 'Frontend');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRootAsync({
      inject: [getConnectionToken()],
      useFactory: (connection: Connection) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        storage: new MongoThrottlerStorage(connection),
        errorMessage: 'Too many requests. Please try again later.',
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '20m' },
      }),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGO_URL'),
      }),
    }),
    ServeStaticModule.forRoot({
      rootPath: frontendRootPath,
      exclude: ['/api/{*path}'],
    }),
    AuthModule,
    EmailModule,
    UsersModule,
    ProductsModule,
    BlogsModule,
    ReviewsModule,
    QuestionsModule,
    OrdersModule,
    ContactModule,
    UploadsModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
