import { BadRequestException } from '@nestjs/common';
import { ShippingOption } from './schemas/order.schema';

export function calculatePricing(
  items: Array<{ price: number; qty: number }>,
  shippingOption: ShippingOption,
  coupon?: { code: string; percentage: number } | null,
) {
  const couponCode = coupon?.code || '';
  if (coupon && (!Number.isInteger(coupon.percentage) || coupon.percentage < 1 || coupon.percentage > 100)) {
    throw new BadRequestException('Invalid coupon percentage.');
  }
  const subtotalCents = items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.qty, 0);
  const discountPercent = coupon?.percentage || 0;
  const discountCents = Math.round(subtotalCents * discountPercent / 100);
  const shippingCents = shippingOption === 'express' ? 1500 :
    shippingOption === 'pickup' ? -Math.round(subtotalCents * 0.05) : 0;
  return {
    subtotal: subtotalCents / 100, couponCode, discountPercent, discount: discountCents / 100,
    shippingCost: shippingCents / 100,
    total: Math.max(0, subtotalCents - discountCents + shippingCents) / 100,
  };
}
