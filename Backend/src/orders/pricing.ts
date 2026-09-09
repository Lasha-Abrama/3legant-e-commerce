import { BadRequestException } from '@nestjs/common';
import { ShippingOption } from './schemas/order.schema';

export const COUPONS: Readonly<Record<string, number>> = Object.freeze({
  WELCOME10: 10, DESIGN15: 15, HOME20: 20, STYLE30: 30, DEMO50: 50,
});

export function calculatePricing(
  items: Array<{ price: number; qty: number }>,
  shippingOption: ShippingOption,
  requestedCode = '',
) {
  const couponCode = requestedCode.trim().toUpperCase();
  if (couponCode && !Object.prototype.hasOwnProperty.call(COUPONS, couponCode)) {
    throw new BadRequestException('Invalid coupon code. Please check the code and try again.');
  }
  const subtotalCents = items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.qty, 0);
  const discountPercent = couponCode ? COUPONS[couponCode] : 0;
  const discountCents = Math.round(subtotalCents * discountPercent / 100);
  const shippingCents = shippingOption === 'express' ? 1500 :
    shippingOption === 'pickup' ? -Math.round(subtotalCents * 0.05) : 0;
  return {
    subtotal: subtotalCents / 100, couponCode, discountPercent, discount: discountCents / 100,
    shippingCost: shippingCents / 100,
    total: Math.max(0, subtotalCents - discountCents + shippingCents) / 100,
  };
}
