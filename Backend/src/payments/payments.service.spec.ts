import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe = require('stripe');
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const configService = {
    get: jest.fn().mockReturnValue('http://localhost:5000'),
    getOrThrow: jest.fn().mockReturnValue('configured-secret'),
  } as unknown as ConfigService;
  const ordersService = {
    findByIdForUser: jest.fn(),
    updateStripePayment: jest.fn(),
  } as unknown as OrdersService;
  const stripeClient = {
    checkout: { sessions: { create: jest.fn() } },
    webhooks: { constructEvent: jest.fn() },
  } as unknown as Stripe;
  const service = new PaymentsService(configService, ordersService);

  beforeEach(() => {
    jest.clearAllMocks();
    (service as any).getStripeClient = jest.fn().mockReturnValue(stripeClient);
  });

  it('creates a hosted Stripe Checkout Session for a pending card order', async () => {
    ordersService.findByIdForUser = jest.fn().mockResolvedValue({
      _id: 'order-id',
      paymentMethod: 'card',
      paymentStatus: 'pending',
      status: 'Processing',
      total: 38,
    });
    stripeClient.checkout.sessions.create = jest.fn().mockResolvedValue({
      id: 'session-id',
      url: 'https://checkout.stripe.com/session-id',
    });

    await expect(service.createCheckoutSession('user-id', 'order-id')).resolves.toEqual({
      checkoutUrl: 'https://checkout.stripe.com/session-id',
      sessionId: 'session-id',
    });
    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        metadata: { orderId: 'order-id', userId: 'user-id' },
      }),
    );
  });

  it('rejects unsupported payment methods', async () => {
    ordersService.findByIdForUser = jest.fn().mockResolvedValue({
      _id: 'order-id',
      paymentMethod: 'paypal',
      paymentStatus: 'pending',
      status: 'Processing',
      total: 38,
    });

    await expect(service.createCheckoutSession('user-id', 'order-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(stripeClient.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('marks an order paid only after a verified Stripe webhook', async () => {
    stripeClient.webhooks.constructEvent = jest.fn().mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'checkout-session-id',
          metadata: { orderId: 'order-id' },
          payment_status: 'paid',
          payment_intent: 'payment-intent-id',
        },
      },
    });
    ordersService.updateStripePayment = jest.fn().mockResolvedValue({});

    await expect(service.handleWebhook(Buffer.from('{}'), 'stripe-signature')).resolves.toEqual({
      received: true,
    });
    expect(ordersService.updateStripePayment).toHaveBeenCalledWith(
      'order-id',
      'paid',
      'checkout-session-id',
      'payment-intent-id',
    );
  });

  it('marks an order failed when its Stripe Checkout Session expires', async () => {
    stripeClient.webhooks.constructEvent = jest.fn().mockReturnValue({
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'checkout-session-id',
          metadata: { orderId: 'order-id' },
          payment_intent: null,
        },
      },
    });
    ordersService.updateStripePayment = jest.fn().mockResolvedValue({});

    await expect(service.handleWebhook(Buffer.from('{}'), 'stripe-signature')).resolves.toEqual({
      received: true,
    });
    expect(ordersService.updateStripePayment).toHaveBeenCalledWith(
      'order-id',
      'failed',
      'checkout-session-id',
      undefined,
    );
  });

  it('rejects webhook requests with invalid Stripe signatures', async () => {
    stripeClient.webhooks.constructEvent = jest.fn().mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    await expect(
      service.handleWebhook(Buffer.from('{}'), 'invalid-signature'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ordersService.updateStripePayment).not.toHaveBeenCalled();
  });
});
