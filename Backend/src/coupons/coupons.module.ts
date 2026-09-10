import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { Coupon, CouponSchema, CouponReservation, CouponReservationSchema } from './coupon.schema';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

@Module({
  imports: [UsersModule, MongooseModule.forFeature([
    { name: Coupon.name, schema: CouponSchema },
    { name: CouponReservation.name, schema: CouponReservationSchema },
  ])],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
