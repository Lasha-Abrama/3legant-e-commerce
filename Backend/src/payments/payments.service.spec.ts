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
    updatePaymentStatus: jest.fn(),
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
          metadata: { orderId: 'order-id' },
          payment_status: 'paid',
        },
      },
    });
    ordersService.updatePaymentStatus = jest.fn().mockResolvedValue({});

    await expect(service.handleWebhook(Buffer.from('{}'), 'stripe-signature')).resolves.toEqual({
      received: true,
    });
    expect(ordersService.updatePaymentStatus).toHaveBeenCalledWith('order-id', 'paid');
  });
});
