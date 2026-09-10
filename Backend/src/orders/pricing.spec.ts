import { BadRequestException } from '@nestjs/common';
import { calculatePricing } from './pricing';

describe('Canonical coupon pricing', () => {
  it.each([
    ['WELCOME10', 10, 90],
    ['DESIGN15', 15, 85],
    ['HOME20', 20, 80],
    ['STYLE30', 30, 70],
    ['DEMO50', 50, 50],
  ])(
    '%s applies to a $100 subtotal and remains reusable',
    (code, percentage, total) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        expect(
          calculatePricing([{ price: 100, qty: 1 }], 'free', {
            code: String(code),
            percentage: Number(percentage),
          }),
        ).toMatchObject({ subtotal: 100, total, discount: 100 - Number(total) });
      }
    },
  );

  it('carries the coupon code through, applies shipping and preserves the pickup discount', () => {
    expect(
      calculatePricing([{ price: 100, qty: 1 }], 'express', {
        code: 'HOME20',
        percentage: 20,
      }),
    ).toMatchObject({ couponCode: 'HOME20', total: 95 });
    expect(
      calculatePricing([{ price: 100, qty: 1 }], 'pickup', {
        code: 'HOME20',
        percentage: 20,
      }),
    ).toMatchObject({ shippingCost: -5, total: 75 });
  });

  it('rounds cents consistently and removes the discount when no coupon is supplied', () => {
    expect(
      calculatePricing([{ price: 19.99, qty: 3 }], 'free', {
        code: 'DESIGN15',
        percentage: 15,
      }),
    ).toMatchObject({ subtotal: 59.97, discount: 9, total: 50.97 });
    expect(calculatePricing([{ price: 100, qty: 1 }], 'free')).toMatchObject({
      discount: 0,
      total: 100,
    });
  });

  it.each([0, 1.5, 101, NaN])('rejects out-of-range coupon percentage %s', (percentage) => {
    expect(() =>
      calculatePricing([{ price: 100, qty: 1 }], 'free', {
        code: 'HOME20',
        percentage,
      }),
    ).toThrow(BadRequestException);
  });
});
