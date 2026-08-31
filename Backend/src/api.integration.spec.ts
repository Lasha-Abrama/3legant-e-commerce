import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import request = require('supertest');
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AdminGuard } from './common/guards/admin.guard';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { UploadsController } from './uploads/uploads.controller';
import { UploadsService } from './uploads/uploads.service';
import { UsersService } from './users/users.service';
import { configureApp } from './setup';
import { HealthController } from './health.controller';

describe('API integration boundaries', () => {
  let app: NestExpressApplication;

  const authService = {
    register: jest.fn(),
    createAuthResponse: jest.fn(),
    validateUser: jest.fn(),
    logout: jest.fn(),
    getUserFromAuthorization: jest.fn(),
  };
  const usersService = {
    findById: jest.fn(),
  };
  const jwtService = {
    verifyAsync: jest.fn(),
  };
  const productsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const ordersService = {
    create: jest.fn(),
    findByUser: jest.fn(),
    findByIdForUser: jest.fn(),
  };
  const uploadsService = {
    uploadBuffer: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        HealthController,
        AuthController,
        ProductsController,
        OrdersController,
        UploadsController,
      ],
      providers: [
        JwtAuthGuard,
        AdminGuard,
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: ProductsService, useValue: productsService },
        { provide: OrdersService, useValue: ordersService },
        { provide: UploadsService, useValue: uploadsService },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app, app.get(ConfigService));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService.verifyAsync.mockImplementation(async (token: string) => {
      if (token === 'admin-token') return { sub: 'admin-id', tokenVersion: 1 };
      if (token === 'user-token') return { sub: 'user-id', tokenVersion: 0 };
      throw new Error('invalid token');
    });
    usersService.findById.mockImplementation(async (id: string) => ({
      _id: id,
      isAdmin: id === 'admin-id',
      tokenVersion: id === 'admin-id' ? 1 : 0,
    }));
  });

  it('reports API health without caching the response', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect({ status: 'ok' });
  });

  it('runs request validation before registration logic', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'password123',
        isAdmin: true,
      })
      .expect(400);

    expect(authService.register).not.toHaveBeenCalled();
  });

  it('registers a valid user through the HTTP controller', async () => {
    authService.register.mockResolvedValue({ _id: 'new-user-id' });
    authService.createAuthResponse.mockResolvedValue({ accessToken: 'token', user: { _id: 'new-user-id' } });

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'password123',
      })
      .expect(201)
      .expect({ accessToken: 'token', user: { _id: 'new-user-id' } });

    expect(authService.register).toHaveBeenCalledWith({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('rejects protected order access without a bearer token', async () => {
    await request(app.getHttpServer()).get('/api/orders/me').expect(401);
    expect(ordersService.findByUser).not.toHaveBeenCalled();
  });

  it('validates nested order payloads after authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', 'Bearer user-token')
      .send({ items: [], paymentMethod: 'card', shippingOption: 'free' })
      .expect(400);

    expect(ordersService.create).not.toHaveBeenCalled();
  });

  it('creates a valid authenticated order with the guard user id', async () => {
    const payload = {
      items: [
        {
          productId: '507f1f77bcf86cd799439011',
          name: 'Tray Table',
          color: 'Black',
          price: 19,
          qty: 1,
        },
      ],
      contact: {
        firstName: 'Test',
        lastName: 'User',
        phone: '+1 555 0100',
        email: 'test@example.com',
      },
      shippingAddress: {
        street: '1 Main Street',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'United States',
      },
      paymentMethod: 'card',
      shippingOption: 'free',
    };
    ordersService.create.mockResolvedValue({ _id: 'order-id' });

    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', 'Bearer user-token')
      .send(payload)
      .expect(201)
      .expect({ _id: 'order-id' });

    expect(ordersService.create).toHaveBeenCalledWith('user-id', payload);
  });

  it('rejects non-admin product mutations', async () => {
    await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', 'Bearer user-token')
      .send({})
      .expect(403);

    expect(productsService.create).not.toHaveBeenCalled();
  });

  it('serves public products with security headers and transformed query values', async () => {
    productsService.findAll.mockResolvedValue({ data: [], total: 0 });

    await request(app.getHttpServer())
      .get('/api/products?take=24&page=2')
      .expect(200)
      .expect('X-Content-Type-Options', 'nosniff')
      .expect({ data: [], total: 0 });

    expect(productsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ take: 24, page: 2 }),
    );
  });

  it('rejects oversized product searches before querying persistence', async () => {
    await request(app.getHttpServer())
      .get('/api/products?search=' + 'a'.repeat(81))
      .expect(400);

    expect(productsService.findAll).not.toHaveBeenCalled();
  });

  it('rejects spoofed image uploads before the upload service', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/admin/uploads/image')
      .set('Authorization', 'Bearer admin-token')
      .attach('file', Buffer.from('<svg><script>alert(1)</script></svg>'), {
        filename: 'image.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('JPEG');

    expect(uploadsService.uploadBuffer).not.toHaveBeenCalled();
  });

  it('accepts a signature-verified admin image upload', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    uploadsService.uploadBuffer.mockResolvedValue({ url: 'https://example.com/image.png' });

    const response = await request(app.getHttpServer())
      .post('/api/admin/uploads/image')
      .set('Authorization', 'Bearer admin-token')
      .attach('file', png, { filename: 'image.png', contentType: 'image/png' });

    expect({ status: response.status, body: response.body }).toEqual({
      status: 201,
      body: { url: 'https://example.com/image.png' },
    });

    expect(uploadsService.uploadBuffer).toHaveBeenCalledWith(expect.any(Buffer), 'image/png');
  });
});
