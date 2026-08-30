import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ProductsService } from '../products/products.service';

describe('OrdersService', () => {
  const productsService = {
    findOne: jest.fn(),
  } as unknown as ProductsService;
  const orderModel = jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue(data),
  }));
  const service = new OrdersService(orderModel as never, productsService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses canonical product data when creating an order', async () => {
    productsService.findOne = jest.fn().mockResolvedValue({
      _id: 'product-id',
      name: 'Tray Table',
      price: 19,
      stock: 10,
      colors: [{ name: 'Black', hex: '#000000' }],
    });

    const order = await service.create('507f1f77bcf86cd799439012', {
      items: [{
        productId: '507f1f77bcf86cd799439011',
        name: 'Forged product name',
        color: 'Black',
        price: 0.01,
        qty: 2,
      }],
      contact: { firstName: 'Sofia', lastName: 'Havertz', phone: '123', email: 'sofia@example.com' },
      shippingAddress: { street: 'Main', city: 'Tbilisi', state: 'Tbilisi', zip: '0100', country: 'Georgia' },
      paymentMethod: 'card',
      shippingOption: 'express',
    });

    expect(order.items).toEqual([{
      productId: 'product-id',
      name: 'Tray Table',
      color: 'Black',
      price: 19,
      qty: 2,
    }]);
    expect(order.subtotal).toBe(38);
    expect(order.total).toBe(53);
    expect(order.paymentStatus).toBe('pending');
    expect(order).not.toHaveProperty('cardNumber');
  });

  it('rejects unavailable colors and insufficient stock', async () => {
    productsService.findOne = jest.fn().mockResolvedValue({
      _id: 'product-id',
      name: 'Tray Table',
      price: 19,
      stock: 1,
      colors: [{ name: 'Black', hex: '#000000' }],
    });
    const baseOrder = {
      productId: '507f1f77bcf86cd799439011',
      name: 'Tray Table',
      price: 19,
      qty: 2,
    };
    const details = {
      contact: { firstName: 'Sofia', lastName: 'Havertz', phone: '123', email: 'sofia@example.com' },
      shippingAddress: { street: 'Main', city: 'Tbilisi', state: 'Tbilisi', zip: '0100', country: 'Georgia' },
      paymentMethod: 'card' as const,
      shippingOption: 'free' as const,
    };

    await expect(service.create('507f1f77bcf86cd799439012', { ...details, items: [{ ...baseOrder, color: 'Red' }] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.create('507f1f77bcf86cd799439012', { ...details, items: [{ ...baseOrder, color: 'Black' }] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects payment methods without a configured provider', async () => {
    await expect(service.create('507f1f77bcf86cd799439012', {
      items: [],
      contact: { firstName: 'Sofia', lastName: 'Havertz', phone: '123', email: 'sofia@example.com' },
      shippingAddress: { street: 'Main', city: 'Tbilisi', state: 'Tbilisi', zip: '0100', country: 'Georgia' },
      paymentMethod: 'paypal',
      shippingOption: 'free',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(productsService.findOne).not.toHaveBeenCalled();
  });

  it('records Stripe references when a pending order becomes paid', async () => {
    const updatedOrder = { _id: 'order-id', paymentStatus: 'paid' };
    (orderModel as any).findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(updatedOrder),
    });

    await expect(
      service.updateStripePayment(
        '507f1f77bcf86cd799439011',
        'paid',
        'checkout-session-id',
        'payment-intent-id',
      ),
    ).resolves.toBe(updatedOrder);
    expect((orderModel as any).findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: '507f1f77bcf86cd799439011',
        paymentStatus: { $in: ['pending', 'failed'] },
      },
      {
        $set: expect.objectContaining({
          paymentStatus: 'paid',
          stripeCheckoutSessionId: 'checkout-session-id',
          stripePaymentIntentId: 'payment-intent-id',
          paidAt: expect.any(Date),
        }),
      },
      { new: true },
    );
  });

  it('does not downgrade a paid order when a late failure event arrives', async () => {
    const paidOrder = { _id: 'order-id', paymentStatus: 'paid' };
    (orderModel as any).findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    (orderModel as any).findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(paidOrder),
    });

    await expect(
      service.updateStripePayment(
        '507f1f77bcf86cd799439011',
        'failed',
        'checkout-session-id',
      ),
    ).resolves.toBe(paidOrder);
    expect((orderModel as any).findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: '507f1f77bcf86cd799439011',
        paymentStatus: { $in: ['pending'] },
      },
      {
        $set: {
          paymentStatus: 'failed',
          stripeCheckoutSessionId: 'checkout-session-id',
        },
      },
      { new: true },
    );
  });
});
