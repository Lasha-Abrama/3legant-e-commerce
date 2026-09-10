import { ThrottlerStorage } from '@nestjs/throttler';
import { Connection } from 'mongoose';
import { createHash } from 'crypto';

export class MongoThrottlerStorage implements ThrottlerStorage {
  private indexes?: Promise<unknown>;

  constructor(private readonly connection: Connection) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, name: string) {
    const collection = this.connection.db!.collection<{ _id: string; totalHits: number; expiresAt: Date; blockedUntil: Date; deleteAt: Date }>('rate_limits');
    this.indexes ??= collection.createIndex({ deleteAt: 1 }, { expireAfterSeconds: 0 });
    await this.indexes;
    const identity = createHash('sha256').update(name + ':' + key).digest('hex');
    const expired = { $and: [
      { $lte: [{ $ifNull: ['$expiresAt', new Date(0)] }, '$$NOW'] },
      { $lte: [{ $ifNull: ['$blockedUntil', new Date(0)] }, '$$NOW'] },
    ] };
    const pipeline = [
      { $set: {
        totalHits: { $cond: [expired, 1, { $add: [{ $ifNull: ['$totalHits', 0] }, 1] }] },
        expiresAt: { $cond: [expired, { $add: ['$$NOW', ttl] }, '$expiresAt'] },
      } },
      { $set: { blockedUntil: { $cond: [
        { $and: [
          { $gt: ['$totalHits', limit] },
          { $lte: [{ $ifNull: ['$blockedUntil', new Date(0)] }, '$$NOW'] },
        ] },
        { $add: ['$$NOW', blockDuration || ttl] },
        { $ifNull: ['$blockedUntil', new Date(0)] },
      ] } } },
      { $set: { deleteAt: { $max: ['$expiresAt', '$blockedUntil'] } } },
    ];
    const update = () => collection.findOneAndUpdate({ _id: identity }, pipeline, { upsert: true, returnDocument: 'after' });
    let record;
    try {
      record = await update();
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 11000)) throw error;
      record = await update();
    }
    const now = Date.now();
    return {
      totalHits: record!.totalHits as number,
      timeToExpire: Math.max(0, Math.ceil((record!.expiresAt.getTime() - now) / 1000)),
      isBlocked: record!.blockedUntil.getTime() > now,
      timeToBlockExpire: Math.max(0, Math.ceil((record!.blockedUntil.getTime() - now) / 1000)),
    };
  }
}
