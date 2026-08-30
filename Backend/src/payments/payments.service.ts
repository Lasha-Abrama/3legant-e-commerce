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
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5000');
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
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
      });
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    return { checkoutUrl: session.url, sessionId: session.id };
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
        );
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
        );
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
}
