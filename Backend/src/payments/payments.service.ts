import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe = require('stripe');
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
  ) {}

  async createCheckoutSession(userId: string, orderId: string) {
    const order = await this.ordersService.findByIdForUser(orderId, userId);
    if (order.paymentMethod !== 'card') {
      throw new BadRequestException('ამ ეტაპზე მხოლოდ ბარათით გადახდაა ხელმისაწვდომი');
    }
    if (order.paymentStatus !== 'pending' || order.status !== 'Processing') {
      throw new BadRequestException('ამ შეკვეთის გადახდა შეუძლებელია');
    }

    const stripe = this.getStripeClient();
    if (order.stripeCheckoutSessionId && order.checkoutSessionStatus === 'open') {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(
          order.stripeCheckoutSessionId,
        );
        if (existingSession.status === 'open' && existingSession.url) {
          return {
            checkoutUrl: existingSession.url,
            sessionId: existingSession.id,
            expiresAt: existingSession.expires_at
              ? new Date(existingSession.expires_at * 1000)
              : undefined,
          };
        }
        if (existingSession.status === 'complete') {
          throw new BadRequestException('ამ შეკვეთის გადახდა უკვე დასრულებულია');
        }
        await this.ordersService.updateCheckoutSessionStatus(
          String(order._id),
          existingSession.id,
          'expired',
        );
        throw new BadRequestException('გადახდის სესია ვადაგასულია; შექმენით ახალი შეკვეთა');
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        if (error instanceof Stripe.errors.StripeError && error.code !== 'resource_missing') {
          throw new BadRequestException(error.message);
        }
      }
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5000');
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: { name: `3legant order ${order._id}` },
                unit_amount: Math.round(order.total * 100),
              },
              quantity: 1,
            },
          ],
          metadata: { orderId: String(order._id), userId },
          success_url: `${frontendUrl}/checkout.html?payment=success&order=${order._id}`,
          cancel_url: `${frontendUrl}/checkout.html?payment=cancelled&order=${order._id}`,
        },
        { idempotencyKey: `order-${order._id}-checkout` },
      );
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }
    await this.ordersService.attachStripeCheckoutSession(
      String(order._id),
      userId,
      session.id,
      new Date(session.expires_at * 1000),
    );
    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      expiresAt: new Date(session.expires_at * 1000),
    };
  }

  async createRefund(orderId: string) {
    const order = await this.ordersService.findById(orderId);
    if (
      order.paymentStatus !== 'paid' ||
      !order.stripePaymentIntentId ||
      order.status !== 'Processing'
    ) {
      throw new BadRequestException('Only unshipped paid Stripe orders can be refunded');
    }

    const stripe = this.getStripeClient();
    let refund: Stripe.Refund;
    try {
      refund = await stripe.refunds.create(
        {
          payment_intent: order.stripePaymentIntentId,
          reason: 'requested_by_customer',
          metadata: { orderId: String(order._id) },
        },
        { idempotencyKey: `order-${order._id}-full-refund` },
      );
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    return { refundId: refund.id, status: refund.status };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const stripe = this.getStripeClient();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.configService.getOrThrow<string>('STRIPE_WEBHOOK_SECRET'),
      );
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId && session.payment_status === 'paid') {
        await this.ordersService.updateStripePayment(
          orderId,
          'paid',
          session.id,
          this.getPaymentIntentId(session),
          'completed',
        );
      } else if (orderId) {
        await this.ordersService.updateCheckoutSessionStatus(orderId, session.id, 'completed');
      }
    }

    if (
      event.type === 'checkout.session.async_payment_failed' ||
      event.type === 'checkout.session.expired'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await this.ordersService.updateStripePayment(
          orderId,
          'failed',
          session.id,
          this.getPaymentIntentId(session),
          event.type === 'checkout.session.expired' ? 'expired' : 'failed',
        );
      }
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = this.getChargePaymentIntentId(charge);
      if (charge.refunded && paymentIntentId) {
        await this.ordersService.refundStripePayment(paymentIntentId, charge.id);
      }
    }

    return { received: true };
  }

  private getStripeClient() {
    return new Stripe(this.configService.getOrThrow<string>('STRIPE_SECRET_KEY'));
  }

  private getPaymentIntentId(session: Stripe.Checkout.Session) {
    if (typeof session.payment_intent === 'string') {
      return session.payment_intent;
    }
    return session.payment_intent?.id;
  }

  private getChargePaymentIntentId(charge: Stripe.Charge) {
    if (typeof charge.payment_intent === 'string') {
      return charge.payment_intent;
    }
    return charge.payment_intent?.id;
  }
}
