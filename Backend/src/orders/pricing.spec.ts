import { BadRequestException } from '@nestjs/common';
import { calculatePricing } from './pricing';

describe('Canonical coupon pricing', () => {
  it.each([['WELCOME10', 90], ['DESIGN15', 85], ['HOME20', 80], ['STYLE30', 70], ['DEMO50', 50]])(
    '%s applies to a $100 subtotal and remains reusable', (code, total) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        expect(calculatePricing([{ price: 100, qty: 1 }], 'free', String(code))).toMatchObject({ subtotal: 100, total, discount: 100 - Number(total) });
      }
    },
  );
  it('normalizes codes, applies shipping and preserves the existing pickup discount', () => {
    expect(calculatePricing([{ price: 100, qty: 1 }], 'express', ' home20 ')).toMatchObject({ couponCode: 'HOME20', total: 95 });
    expect(calculatePricing([{ price: 100, qty: 1 }], 'pickup', 'HOME20')).toMatchObject({ shippingCost: -5, total: 75 });
  });
  it('rounds cents consistently and removes the discount when no code is supplied', () => {
    expect(calculatePricing([{ price: 19.99, qty: 3 }], 'free', 'DESIGN15')).toMatchObject({ subtotal: 59.97, discount: 9, total: 50.97 });
    expect(calculatePricing([{ price: 100, qty: 1 }], 'free')).toMatchObject({ discount: 0, total: 100 });
  });
  it.each(['bad', 'toString', '__proto__'])('rejects invalid code %s', code => {
    expect(() => calculatePricing([{ price: 100, qty: 1 }], 'free', code)).toThrow(BadRequestException);
  });
});
