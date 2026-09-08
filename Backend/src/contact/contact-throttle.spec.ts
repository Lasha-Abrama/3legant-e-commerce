import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request = require('supertest');
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

describe('Public email endpoint rate limits', () => {
  let app: INestApplication;
  const service = { createMessage: jest.fn().mockResolvedValue({ message: 'saved' }), subscribe: jest.fn().mockResolvedValue({ message: 'saved' }) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])],
      controllers: [ContactController],
      providers: [{ provide: ContactService, useValue: service }, { provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  it.each(['/contact', '/newsletter'])('limits %s to five requests even with spoofed forwarded headers', async (route) => {
    for (let i = 0; i < 5; i++) await request(app.getHttpServer()).post(route).set('X-Forwarded-For', '203.0.113.' + i).send({}).expect(200);
    await request(app.getHttpServer()).post(route).set('X-Forwarded-For', '203.0.113.99').send({}).expect(429);
  });
});
