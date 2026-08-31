import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ProductsService } from '../products/products.service';

describe('OrdersService', () => {
  const productsService = {
    findOne: jest.fn(),
    decrementStock: jest.fn(),
    incrementStock: jest.fn(),
  } as unknown as ProductsService;
  const orderModel = jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue(data),
  }));
  const session = {
    withTransaction: jest.fn(async (callback: () => Promise<void>) => callback()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
  const connection = {
    startSession: jest.fn().mockResolvedValue(session),
  };
  const service = new OrdersService(orderModel as never, productsService, connection as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an order only when it belongs to the requesting user', async () => {
    const ownedOrder = { _id: 'order-id', user: 'user-id' };
    (orderModel as any).findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(ownedOrder),
    });

    await expect(service.findByIdForUser('order-id', 'user-id')).resolves.toBe(ownedOrder);
    expect((orderModel as any).findOne).toHaveBeenCalledWith({
      _id: 'order-id',
      user: 'user-id',
    });
  });

  it('does not expose an order owned by another user', async () => {
    (orderModel as any).findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.findByIdForUser('order-id', 'other-user-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('recognizes products from a paid customer order', async () => {
    (orderModel as any).exists = jest.fn().mockResolvedValue({ _id: 'order-id' });

    await expect(
      service.hasPurchasedProduct('user-id', 'product-id'),
    ).resolves.toBe(true);
    expect((orderModel as any).exists).toHaveBeenCalledWith({
      user: 'user-id',
      paymentStatus: 'paid',
      status: { $ne: 'Cancelled' },
      'items.productId': 'product-id',
    });

    (orderModel as any).exists = jest.fn().mockResolvedValue(null);
    await expect(
      service.hasPurchasedProduct('user-id', 'other-product-id'),
    ).resolves.toBe(false);
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
    expect(order.inventoryStatus).toBe('pending');
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
    const updatedOrder = {
      _id: 'order-id',
      paymentStatus: 'paid',
      items: [{ productId: 'product-id', qty: 2 }],
    };
    (orderModel as any).findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(updatedOrder),
    });
    productsService.decrementStock = jest.fn().mockResolvedValue(undefined);

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
          inventoryStatus: 'adjusted',
          inventoryAdjustedAt: expect.any(Date),
        }),
      },
      { new: true, session },
    );
    expect(productsService.decrementStock).toHaveBeenCalledWith(updatedOrder.items, session);
    expect(session.endSession).toHaveBeenCalled();
  });

  it('does not downgrade a paid order when a late failure event arrives', async () => {
    const paidOrder = { _id: 'order-id', paymentStatus: 'paid' };
    (orderModel as any).findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    const findPaidOrder = jest.fn().mockResolvedValue(paidOrder);
    (orderModel as any).findById = jest.fn().mockReturnValue({
      exec: findPaidOrder,
      session: jest.fn().mockReturnValue({
        exec: findPaidOrder,
      }),
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
          checkoutSessionStatus: 'failed',
        },
      },
      { new: true },
    );
    expect(productsService.decrementStock).not.toHaveBeenCalled();
  });

  it('records paid orders with an inventory issue when stock changed before payment', async () => {
    const transactionOrder = {
      _id: 'order-id',
      paymentStatus: 'paid',
      items: [{ productId: 'product-id', qty: 2 }],
    };
    const inventoryIssueOrder = {
      ...transactionOrder,
      inventoryStatus: 'insufficient',
    };
    (orderModel as any).findOneAndUpdate = jest
      .fn()
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(transactionOrder) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(inventoryIssueOrder) });
    productsService.decrementStock = jest
      .fn()
      .mockRejectedValue(new ConflictException('Insufficient stock'));

    await expect(
      service.updateStripePayment(
        '507f1f77bcf86cd799439011',
        'paid',
        'checkout-session-id',
        'payment-intent-id',
      ),
    ).resolves.toBe(inventoryIssueOrder);
    expect((orderModel as any).findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      {
        _id: '507f1f77bcf86cd799439011',
        paymentStatus: { $in: ['pending', 'failed'] },
      },
      {
        $set: expect.objectContaining({
          paymentStatus: 'paid',
          inventoryStatus: 'insufficient',
        }),
      },
      { new: true },
    );
  });

  it('restores stock once when a paid order is refunded', async () => {
    const refundedOrder = {
      _id: 'order-id',
      paymentStatus: 'refunded',
      inventoryStatus: 'adjusted',
      status: 'Processing',
      items: [{ productId: 'product-id', qty: 2 }],
    };
    (orderModel as any).findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(refundedOrder),
    });
    (orderModel as any).updateOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });
    productsService.incrementStock = jest.fn().mockResolvedValue(undefined);

    await expect(
      service.refundStripePayment('payment-intent-id', 'charge-id'),
    ).resolves.toEqual(expect.objectContaining({
      paymentStatus: 'refunded',
      inventoryStatus: 'restored',
    }));
    expect(productsService.incrementStock).toHaveBeenCalledWith(refundedOrder.items, session);
    expect((orderModel as any).updateOne).toHaveBeenCalledWith(
      { _id: 'order-id' },
      {
        $set: {
          inventoryStatus: 'restored',
          inventoryRestoredAt: expect.any(Date),
        },
      },
      { session },
    );
  });

  it('does not restore stock twice for duplicate refund webhooks', async () => {
    const alreadyRefundedOrder = {
      _id: 'order-id',
      paymentStatus: 'refunded',
      inventoryStatus: 'restored',
    };
    (orderModel as any).findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    (orderModel as any).findOne = jest.fn().mockReturnValue({
      session: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(alreadyRefundedOrder),
      }),
    });

    await expect(
      service.refundStripePayment('payment-intent-id', 'charge-id'),
    ).resolves.toBe(alreadyRefundedOrder);
    expect(productsService.incrementStock).not.toHaveBeenCalled();
  });

  it('ignores refund webhooks for charges unrelated to an order', async () => {
    (orderModel as any).findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    (orderModel as any).findOne = jest.fn().mockReturnValue({
      session: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(
      service.refundStripePayment('unrelated-payment-intent', 'charge-id'),
    ).resolves.toBeNull();
    expect(productsService.incrementStock).not.toHaveBeenCalled();
  });

  it('tracks refunds whose inventory could not be restored', async () => {
    const transactionOrder = {
      _id: 'order-id',
      paymentStatus: 'refunded',
      inventoryStatus: 'adjusted',
      status: 'Processing',
      items: [{ productId: 'missing-product', qty: 1 }],
    };
    const restoreFailedOrder = {
      ...transactionOrder,
      inventoryStatus: 'restore_failed',
    };
    (orderModel as any).findOneAndUpdate = jest
      .fn()
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(transactionOrder) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(restoreFailedOrder) });
    productsService.incrementStock = jest
      .fn()
      .mockRejectedValue(new ConflictException('Product missing'));

    await expect(
      service.refundStripePayment('payment-intent-id', 'charge-id'),
    ).resolves.toBe(restoreFailedOrder);
    expect((orderModel as any).findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { stripePaymentIntentId: 'payment-intent-id', paymentStatus: 'paid' },
      {
        $set: expect.objectContaining({
          paymentStatus: 'refunded',
          inventoryStatus: 'restore_failed',
        }),
      },
      { new: true },
    );
  });

  it('does not restock an externally refunded order that already shipped', async () => {
    const shippedOrder = {
      _id: 'order-id',
      paymentStatus: 'refunded',
      inventoryStatus: 'adjusted',
      status: 'Shipped',
      items: [{ productId: 'product-id', qty: 1 }],
    };
    (orderModel as any).findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(shippedOrder),
    });
    (orderModel as any).updateOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });

    await expect(
      service.refundStripePayment('payment-intent-id', 'charge-id'),
    ).resolves.toEqual(expect.objectContaining({ inventoryStatus: 'return_required' }));
    expect(productsService.incrementStock).not.toHaveBeenCalled();
    expect((orderModel as any).updateOne).toHaveBeenCalledWith(
      { _id: 'order-id' },
      { $set: { inventoryStatus: 'return_required' } },
      { session },
    );
  });

  it('ships only paid orders with adjusted inventory', async () => {
    const processingOrder = {
      _id: 'order-id',
      status: 'Processing',
      paymentStatus: 'paid',
      inventoryStatus: 'adjusted',
    };
    const shippedOrder = { ...processingOrder, status: 'Shipped' };
    (orderModel as any).findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(processingOrder),
    });
    (orderModel as any).findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(shippedOrder),
    });

    await expect(service.updateStatus('order-id', 'Shipped')).resolves.toBe(shippedOrder);
    expect((orderModel as any).findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 'order-id',
        status: 'Processing',
        paymentStatus: 'paid',
        inventoryStatus: 'adjusted',
      },
      { $set: { status: 'Shipped' } },
      { new: true },
    );
  });

  it('rejects shipping unpaid orders and invalid backward transitions', async () => {
    (orderModel as any).findById = jest.fn().mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue({
        _id: 'order-id',
        status: 'Processing',
        paymentStatus: 'pending',
        inventoryStatus: 'pending',
      }),
    }).mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue({
        _id: 'order-id',
        status: 'Delivered',
        paymentStatus: 'paid',
        inventoryStatus: 'adjusted',
      }),
    });

    await expect(service.updateStatus('order-id', 'Shipped')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateStatus('order-id', 'Processing')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect((orderModel as any).findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('requires paid orders to be refunded before cancellation', async () => {
    (orderModel as any).findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: 'order-id',
        status: 'Processing',
        paymentStatus: 'paid',
        inventoryStatus: 'adjusted',
      }),
    });

    await expect(service.updateStatus('order-id', 'Cancelled')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allows refunded processing orders to be cancelled', async () => {
    const refundedOrder = {
      _id: 'order-id',
      status: 'Processing',
      paymentStatus: 'refunded',
      inventoryStatus: 'restored',
    };
    const cancelledOrder = { ...refundedOrder, status: 'Cancelled' };
    (orderModel as any).findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(refundedOrder),
    });
    (orderModel as any).findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(cancelledOrder),
    });

    await expect(service.updateStatus('order-id', 'Cancelled')).resolves.toBe(cancelledOrder);
  });
});
