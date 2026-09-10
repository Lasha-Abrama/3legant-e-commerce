import { Types } from 'mongoose';
import { CouponsService } from './coupons.service';

describe('Coupon payment reservations', () => {
  const query = (value: unknown) => ({ session: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(value) });
  let coupons: any;
  let reservations: any;
  let session: any;
  let service: CouponsService;
  const couponId = new Types.ObjectId();
  const order = { _id: new Types.ObjectId(), couponId, couponCode: 'HOME2026', discountPercent: 20 };
  beforeEach(() => {
    session = { withTransaction: jest.fn(async (run) => run()), endSession: jest.fn() };
    coupons = { findOne: jest.fn().mockReturnValue(query({ _id: couponId, code: 'HOME2026', percentage: 20,
      active: true, expiresAt: new Date(Date.now() + 100000), usedCount: 0, reservedCount: 0, usageLimit: 1 })),
      updateOne: jest.fn().mockReturnValue(query({ modifiedCount: 1 })) };
    reservations = { findOne: jest.fn().mockReturnValue(query(null)), create: jest.fn(),
      findOneAndUpdate: jest.fn(), exists: jest.fn() };
    service = new CouponsService(coupons, reservations, { startSession: async () => session } as never);
  });
  it('reserves in a transaction without counting a paid use', async () => {
    await service.reserve(order);
    expect(coupons.updateOne).toHaveBeenCalledWith(expect.objectContaining({ _id: couponId,
      $or: expect.arrayContaining([expect.objectContaining({ $expr: expect.any(Object) })]) }),
    { $inc: { reservedCount: 1 } }, { session });
    expect(reservations.create).toHaveBeenCalledWith([{ orderId: order._id, couponId, state: 'held' }], { session });
    expect(session.endSession).toHaveBeenCalled();
  });
  it('rejects a concurrent loss of the last available slot', async () => {
    coupons.updateOne.mockReturnValue(query({ modifiedCount: 0 }));
    await expect(service.reserve(order)).rejects.toThrow('Coupon usage limit reached.');
    expect(reservations.create).not.toHaveBeenCalled();
  });
  it('does not reserve again for a checkout retry', async () => {
    reservations.findOne.mockReturnValue(query({ state: 'held' }));
    await service.reserve(order);
    expect(coupons.updateOne).not.toHaveBeenCalled();
  });
  it('rejects a changed discount before creating a reservation', async () => {
    await expect(service.reserve({ ...order, discountPercent: 30 })).rejects.toThrow('Coupon changed');
    expect(coupons.updateOne).not.toHaveBeenCalled();
  });
  it('moves held capacity into paid usage exactly once', async () => {
    reservations.findOneAndUpdate.mockReturnValueOnce(query({ couponId })).mockReturnValueOnce(query(null));
    reservations.exists.mockReturnValue({ session: jest.fn().mockResolvedValue({}) });
    await service.consume(order._id, session);
    await service.consume(order._id, session);
    expect(coupons.updateOne).toHaveBeenCalledTimes(1);
    expect(coupons.updateOne).toHaveBeenCalledWith({ _id: couponId, reservedCount: { $gt: 0 } },
      { $inc: { reservedCount: -1, usedCount: 1 } }, { session });
  });
  it('releases held capacity once across repeated failed or expired events', async () => {
    reservations.findOneAndUpdate.mockReturnValueOnce(query({ couponId })).mockReturnValueOnce(query(null));
    await service.release(String(order._id));
    await service.release(String(order._id));
    expect(coupons.updateOne).toHaveBeenCalledTimes(1);
    expect(coupons.updateOne).toHaveBeenCalledWith({ _id: couponId, reservedCount: { $gt: 0 } },
      { $inc: { reservedCount: -1 } }, { session });
  });
});
