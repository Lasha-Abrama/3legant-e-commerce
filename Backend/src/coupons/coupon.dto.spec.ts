import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCouponDto, UpdateCouponDto } from './coupon.dto';
import { CouponSchema } from './coupon.schema';
import { model } from 'mongoose';

describe('Coupon validation', () => {
  const base = { percentage: 20, expiresAt: '2099-01-01T00:00:00.000Z' };
  it.each(['ABCDEFG', 'ABCDEFGHIJKLM', 'HOME-2026', 'BAD CODE', ''])('rejects code %p on create and edit', async (code) => {
    for (const dto of [plainToInstance(CreateCouponDto, { ...base, code }), plainToInstance(UpdateCouponDto, { code })]) {
      expect((await validate(dto)).some((error) => error.property === 'code')).toBe(true);
    }
  });
  it.each(['abcd2345', 'ABCD23456789'])('accepts and normalizes valid code %s', async (code) => {
    const dto = plainToInstance(CreateCouponDto, { ...base, code });
    expect(await validate(dto)).toEqual([]);
    expect(dto.code).toBe(code.toUpperCase());
  });
  it('enforces the code format at the schema boundary and retains the unique index', () => {
    const Coupon = model('CouponValidationTest', CouponSchema);
    expect(new Coupon({ ...base, code: 'SHORT' }).validateSync()?.errors.code).toBeDefined();
    expect(CouponSchema.indexes()).toContainEqual([{ code: 1 }, expect.objectContaining({ unique: true })]);
  });
});
