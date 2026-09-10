import { BadRequestException } from '@nestjs/common';
import { CouponsService } from './coupons.service';

describe('CouponsService', () => {
  const findOne = jest.fn();
  const coupons = { findOne };
  const service = new CouponsService(coupons as never, {} as never, {} as never);

  const validCoupon = () => ({
    code: 'HOME20',
    percentage: 20,
    expiresAt: new Date(Date.now() + 100_000),
    active: true,
    usedCount: 0,
    reservedCount: 0,
    usageLimit: null,
  });

  function mockLookup(coupon: unknown) {
    const exec = jest.fn().mockResolvedValue(coupon);
    findOne.mockReturnValue({ session: jest.fn().mockReturnValue({ exec }) });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([[undefined], ['  ']])('returns null when %p is supplied as the code', async (code) => {
    await expect(service.validate(code)).resolves.toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });

  it('normalizes the code before looking it up', async () => {
    const coupon = validCoupon();
    mockLookup(coupon);

    await expect(service.validate(' home20 ')).resolves.toBe(coupon);
    expect(findOne).toHaveBeenCalledWith({ code: 'HOME20' });
  });

  it.each(['bad', 'toString', '__proto__'])('rejects unknown code %s', async (code) => {
    mockLookup(null);

    await expect(service.validate(String(code))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects expired, inactive and fully used coupons', async () => {
    const expired = {
      ...validCoupon(),
      code: 'OLD',
      expiresAt: new Date(Date.now() - 1_000),
    };
    const inactive = { ...validCoupon(), code: 'OFF', active: false };
    const exhausted = {
      ...validCoupon(),
      code: 'DONE',
      usedCount: 3,
      reservedCount: 2,
      usageLimit: 5,
    };

    for (const coupon of [expired, inactive, exhausted]) {
      mockLookup(coupon);
      await expect(service.validate('X')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });
});