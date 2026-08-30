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
    findById: jest.fn(),
    findByIdForUser: jest.fn(),
    attachStripeCheckoutSession: jest.fn(),
    updateCheckoutSessionStatus: jest.fn(),
    refundStripePayment: jest.fn(),
    updateStripePayment: jest.fn(),
  } as unknown as OrdersService;
  const stripeClient = {
    checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } },
    refunds: { create: jest.fn() },
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
      expires_at: 1700000000,
    });
    ordersService.attachStripeCheckoutSession = jest.fn().mockResolvedValue({});

    await expect(service.createCheckoutSession('user-id', 'order-id')).resolves.toEqual({
      checkoutUrl: 'https://checkout.stripe.com/session-id',
      sessionId: 'session-id',
      expiresAt: new Date(1700000000 * 1000),
    });
    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        metadata: { orderId: 'order-id', userId: 'user-id' },
      }),
      { idempotencyKey: 'order-order-id-checkout' },
    );
    expect(ordersService.attachStripeCheckoutSession).toHaveBeenCalledWith(
      'order-id',
      'user-id',
      'session-id',
      new Date(1700000000 * 1000),
    );
  });

  it('reuses an open Stripe Checkout Session for the same order', async () => {
    ordersService.findByIdForUser = jest.fn().mockResolvedValue({
      _id: 'order-id',
      paymentMethod: 'card',
      paymentStatus: 'pending',
      status: 'Processing',
      checkoutSessionStatus: 'open',
      stripeCheckoutSessionId: 'existing-session-id',
      total: 38,
    });
    stripeClient.checkout.sessions.retrieve = jest.fn().mockResolvedValue({
      id: 'existing-session-id',
      status: 'open',
      url: 'https://checkout.stripe.com/existing-session-id',
      expires_at: 1700000000,
    });

    await expect(service.createCheckoutSession('user-id', 'order-id')).resolves.toEqual({
      checkoutUrl: 'https://checkout.stripe.com/existing-session-id',
      sessionId: 'existing-session-id',
      expiresAt: new Date(1700000000 * 1000),
    });
    expect(stripeClient.checkout.sessions.create).not.toHaveBeenCalled();
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

  it('creates an idempotent full refund for a paid Stripe order', async () => {
    ordersService.findById = jest.fn().mockResolvedValue({
      _id: 'order-id',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'payment-intent-id',
      status: 'Processing',
    });
    stripeClient.refunds.create = jest.fn().mockResolvedValue({
      id: 'refund-id',
      status: 'succeeded',
    });

    await expect(service.createRefund('order-id')).resolves.toEqual({
      refundId: 'refund-id',
      status: 'succeeded',
    });
    expect(stripeClient.refunds.create).toHaveBeenCalledWith(
      {
        payment_intent: 'payment-intent-id',
        reason: 'requested_by_customer',
        metadata: { orderId: 'order-id' },
      },
      { idempotencyKey: 'order-order-id-full-refund' },
    );
  });

  it('rejects refunds for orders without a completed Stripe payment', async () => {
    ordersService.findById = jest.fn().mockResolvedValue({
      _id: 'order-id',
      paymentStatus: 'pending',
    });

    await expect(service.createRefund('order-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(stripeClient.refunds.create).not.toHaveBeenCalled();
  });

  it('rejects automatic refunds after an order has shipped', async () => {
    ordersService.findById = jest.fn().mockResolvedValue({
      _id: 'order-id',
      paymentStatus: 'paid',
      stripePaymentIntentId: 'payment-intent-id',
      status: 'Shipped',
    });

    await expect(service.createRefund('order-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(stripeClient.refunds.create).not.toHaveBeenCalled();
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
      'completed',
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
      'expired',
    );
  });

  it('finalizes a full refund only after a verified Stripe webhook', async () => {
    stripeClient.webhooks.constructEvent = jest.fn().mockReturnValue({
      type: 'charge.refunded',
      data: {
        object: {
          id: 'charge-id',
          refunded: true,
          payment_intent: 'payment-intent-id',
        },
      },
    });
    ordersService.refundStripePayment = jest.fn().mockResolvedValue({});

    await expect(service.handleWebhook(Buffer.from('{}'), 'stripe-signature')).resolves.toEqual({
      received: true,
    });
    expect(ordersService.refundStripePayment).toHaveBeenCalledWith(
      'payment-intent-id',
      'charge-id',
    );
  });

  it('ignores partial charge refunds', async () => {
    stripeClient.webhooks.constructEvent = jest.fn().mockReturnValue({
      type: 'charge.refunded',
      data: {
        object: {
          id: 'charge-id',
          refunded: false,
          payment_intent: 'payment-intent-id',
        },
      },
    });

    await expect(service.handleWebhook(Buffer.from('{}'), 'stripe-signature')).resolves.toEqual({
      received: true,
    });
    expect(ordersService.refundStripePayment).not.toHaveBeenCalled();
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
