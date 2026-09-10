import { BadRequestException } from '@nestjs/common';
import { CouponsService } from './coupons.service';

describe('CouponsService', () => {
  const findOne = jest.fn();
  const coupons = { findOne, exists: jest.fn(), create: jest.fn(), findOneAndDelete: jest.fn() };
  const service = new CouponsService(coupons as never, {} as never, {} as never);

  const validCoupon = () => ({
    code: 'HOME2026',
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

    await expect(service.validate(' home2026 ')).resolves.toBe(coupon);
    expect(findOne).toHaveBeenCalledWith({ code: 'HOME2026' });
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

    for (const [coupon, message] of [[expired, 'Coupon has expired.'], [inactive, 'Coupon is inactive.'],
      [exhausted, 'Coupon usage limit reached.']] as const) {
      mockLookup(coupon);
      await expect(service.validate('HOME2026')).rejects.toThrow(message);
    }
  });

  it('retries generated collisions and produces a readable 10-character code', async () => {
    coupons.exists.mockResolvedValueOnce({ _id: 'taken' }).mockResolvedValueOnce(null);
    const result = await service.generate();
    expect(result.code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    expect(coupons.exists).toHaveBeenCalledTimes(2);
  });

  it('bounds generation retries', async () => {
    coupons.exists.mockResolvedValue({ _id: 'taken' });
    await expect(service.generate()).rejects.toThrow('Could not generate a unique coupon');
    expect(coupons.exists).toHaveBeenCalledTimes(10);
  });

  it('reports a database uniqueness race without overwriting the existing coupon', async () => {
    coupons.create.mockRejectedValue({ code: 11000 });
    await expect(service.create({ code: 'HOME2026', percentage: 20,
      expiresAt: new Date(Date.now() + 100000).toISOString() })).rejects.toThrow('already exists');
  });

  it('only deletes an inactive coupon without held payments', async () => {
    coupons.findOneAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
    await expect(service.remove('coupon-id')).resolves.toEqual({ message: 'Coupon deleted.' });
    expect(coupons.findOneAndDelete).toHaveBeenCalledWith({ _id: 'coupon-id', active: false, reservedCount: 0 });
    coupons.findOneAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    coupons.exists.mockResolvedValue({ _id: 'coupon-id' });
    await expect(service.remove('coupon-id')).rejects.toThrow('wait for held payments');
  });
});
