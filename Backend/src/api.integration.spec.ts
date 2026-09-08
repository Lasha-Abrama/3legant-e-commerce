import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import request = require('supertest');
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { GoogleOAuthService } from './auth/google-oauth.service';
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
import { ContactController } from './contact/contact.controller';
import { ContactService } from './contact/contact.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('API integration boundaries', () => {
  let app: NestExpressApplication;

  const authService = {
    register: jest.fn(),
    createAuthResponse: jest.fn(),
    validateUser: jest.fn(),
    logout: jest.fn(),
    getUserFromAuthorization: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
    signInWithGoogle: jest.fn(),
  };
  const googleOAuthService = {
    createState: jest.fn(),
    getStateCookieName: jest.fn(),
    createStateCookieValue: jest.fn(),
    getStateCookieOptions: jest.fn(),
    getStateCookieClearOptions: jest.fn(),
    getSessionCookieName: jest.fn(),
    getSessionCookieOptions: jest.fn(),
    getSessionCookieClearOptions: jest.fn(),
    getAuthorizationUrl: jest.fn(),
    getSafeReturnPath: jest.fn(),
    getFrontendCallbackUrl: jest.fn(),
    validateState: jest.fn(),
    getProfileFromAuthorizationCode: jest.fn(),
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
  const contactService = {
    createMessage: jest.fn(),
    subscribe: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        HealthController,
        AuthController,
        ProductsController,
        OrdersController,
        UploadsController,
        ContactController,
      ],
      providers: [
        JwtAuthGuard,
        AdminGuard,
        { provide: AuthService, useValue: authService },
        { provide: GoogleOAuthService, useValue: googleOAuthService },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: ProductsService, useValue: productsService },
        { provide: OrdersService, useValue: ordersService },
        { provide: UploadsService, useValue: uploadsService },
        { provide: ContactService, useValue: contactService },
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
    contactService.createMessage.mockReset();
    contactService.subscribe.mockReset();
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
    googleOAuthService.createState.mockReturnValue('oauth-state');
    googleOAuthService.getStateCookieName.mockReturnValue('google_oauth_state');
    googleOAuthService.createStateCookieValue.mockReturnValue('encoded-state.signature');
    googleOAuthService.getStateCookieOptions.mockReturnValue({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 600_000,
      path: '/api/auth/google/callback',
    });
    googleOAuthService.getStateCookieClearOptions.mockReturnValue({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/api/auth/google/callback',
    });
    googleOAuthService.getSessionCookieName.mockReturnValue('google_oauth_session');
    googleOAuthService.getSessionCookieOptions.mockReturnValue({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 60_000,
      path: '/api/auth/google',
    });
    googleOAuthService.getSessionCookieClearOptions.mockReturnValue({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/api/auth/google',
    });
    googleOAuthService.getAuthorizationUrl.mockReturnValue('https://accounts.google.com/oauth');
    googleOAuthService.getSafeReturnPath.mockReturnValue('/account.html');
    googleOAuthService.getFrontendCallbackUrl.mockImplementation((next?: string, error?: string) => (
      error
        ? `https://store.example/oauth-callback.html?error=${error}`
        : `https://store.example/oauth-callback.html?next=${encodeURIComponent(next || '/account.html')}`
    ));
  });

  it('reports API health without caching the response', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect({ status: 'ok' });
  });

  it('validates Contact Us submissions before calling the service', async () => {
    const invalidPayloads = [
      {},
      { name: 'Customer', email: 'not-an-email', message: 'Please help.' },
      { name: '   ', email: 'customer@example.com', message: 'Please help.' },
      { name: 'Customer', email: 'customer@example.com', message: '   ' },
      { name: 'Customer', email: 'customer@example.com', message: 'Please help.', isAdmin: true },
    ];
    for (const payload of invalidPayloads) {
      await request(app.getHttpServer()).post('/api/contact').send(payload).expect(400);
    }
    expect(contactService.createMessage).not.toHaveBeenCalled();
  });

  it('accepts and trims a valid Contact Us submission', async () => {
    const response = {
      message: 'Your message was sent successfully. We will get back to you as soon as possible.',
    };
    contactService.createMessage.mockResolvedValue(response);
    await request(app.getHttpServer())
      .post('/api/contact')
      .send({
        name: '  Test Customer  ',
        email: '  customer@example.com  ',
        message: '  Please help with my order.  ',
      })
      .expect(200)
      .expect(response);
    expect(contactService.createMessage).toHaveBeenCalledWith({
      name: 'Test Customer',
      email: 'customer@example.com',
      message: 'Please help with my order.',
    });
  });

  it('returns a safe Contact Us error when delivery is unavailable', async () => {
    contactService.createMessage.mockRejectedValue(new ServiceUnavailableException(
      'Your message was saved, but email delivery is temporarily unavailable.',
    ));
    await request(app.getHttpServer())
      .post('/api/contact')
      .send({ name: 'Customer', email: 'customer@example.com', message: 'Please help.' })
      .expect(503)
      .expect(({ body }) => {
        expect(body.message).toBe(
          'Your message was saved, but email delivery is temporarily unavailable.',
        );
        expect(JSON.stringify(body)).not.toContain('SMTP');
      });
  });

  it('validates newsletter subscriptions before calling the service', async () => {
    for (const payload of [
      {},
      { email: 'not-an-email' },
      { email: '   ' },
      { email: 'customer@example.com', isAdmin: true },
    ]) {
      await request(app.getHttpServer()).post('/api/newsletter').send(payload).expect(400);
    }
    expect(contactService.subscribe).not.toHaveBeenCalled();
  });

  it('accepts and trims a valid newsletter subscription', async () => {
    const response = {
      message: 'You successfully joined our newsletter. Please check your email.',
    };
    contactService.subscribe.mockResolvedValue(response);
    await request(app.getHttpServer())
      .post('/api/newsletter')
      .send({ email: '  subscriber@example.com  ' })
      .expect(200)
      .expect(response);
    expect(contactService.subscribe).toHaveBeenCalledWith({ email: 'subscriber@example.com' });
  });

  it('returns a safe newsletter error when delivery is unavailable', async () => {
    contactService.subscribe.mockRejectedValue(new ServiceUnavailableException(
      'Your subscription was saved, but email delivery is temporarily unavailable.',
    ));
    await request(app.getHttpServer())
      .post('/api/newsletter')
      .send({ email: 'subscriber@example.com' })
      .expect(503)
      .expect(({ body }) => {
        expect(body.message).toBe(
          'Your subscription was saved, but email delivery is temporarily unavailable.',
        );
        expect(JSON.stringify(body)).not.toContain('SMTP');
      });
  });

  it('runs request validation before registration logic', async () => {
    const invalidPayloads = [
      {
        firstName: 'Test',
        lastName: 'User',
        email: 'not-an-email',
        password: 'password123',
      },
      {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'short',
      },
      {
        firstName: 'Test',
        email: 'test@example.com',
        password: 'password123',
      },
      {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'password123',
        isAdmin: true,
      },
    ];

    for (const payload of invalidPayloads) {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(payload)
        .expect(400);
    }

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

  it('starts Google OAuth with a state cookie', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/google')
      .expect(302);

    expect(response.headers.location).toBe('https://accounts.google.com/oauth');
    expect(response.headers['set-cookie'][0]).toContain('google_oauth_state=encoded-state.signature');
    expect(googleOAuthService.getAuthorizationUrl).toHaveBeenCalledWith('oauth-state');
  });

  it('handles cancelled Google OAuth authentication without exchanging a code', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/google/callback?error=access_denied')
      .expect(302)
      .expect('Location', 'https://store.example/oauth-callback.html?error=cancelled');

    expect(googleOAuthService.getProfileFromAuthorizationCode).not.toHaveBeenCalled();
  });

  it('completes Google OAuth after validating the state cookie', async () => {
    const profile = {
      googleId: 'google-user-id',
      email: 'google@example.com',
      firstName: 'Google',
      lastName: 'User',
    };
    googleOAuthService.getProfileFromAuthorizationCode.mockResolvedValue(profile);
    authService.signInWithGoogle.mockResolvedValue({ accessToken: 'google-token', user: { id: 'google-user-id' } });

    await request(app.getHttpServer())
      .get('/api/auth/google/callback?code=google-code&state=oauth-state')
      .set('Cookie', 'google_oauth_state=encoded-state.signature')
      .expect(302)
      .expect('Location', 'https://store.example/oauth-callback.html?next=%2Faccount.html');

    expect(googleOAuthService.validateState).toHaveBeenCalledWith('oauth-state', 'encoded-state.signature');
    expect(authService.signInWithGoogle).toHaveBeenCalledWith(profile);
  });

  it('exchanges the one-time Google session cookie for the normal JWT response', async () => {
    authService.getUserFromAuthorization.mockResolvedValue({ id: 'google-user-id' });

    await request(app.getHttpServer())
      .get('/api/auth/google/session')
      .set('Cookie', 'google_oauth_session=google-token')
      .expect(200)
      .expect({ accessToken: 'google-token', user: { id: 'google-user-id' } });

    expect(authService.getUserFromAuthorization).toHaveBeenCalledWith('Bearer google-token');
  });

  it('validates password reset requests at the HTTP boundary', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token: 'short', password: 'short' })
      .expect(400);

    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('accepts valid password recovery requests', async () => {
    authService.requestPasswordReset.mockResolvedValue({ message: 'Check your email' });
    authService.resetPassword.mockResolvedValue({ message: 'Password reset' });

    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'test@example.com' })
      .expect(200)
      .expect({ message: 'Check your email' });
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(43), password: 'new-password' })
      .expect(200)
      .expect({ message: 'Password reset' });
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
