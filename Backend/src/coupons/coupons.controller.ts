import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CreateCouponDto, UpdateCouponDto } from './coupon.dto';
import { CouponsService } from './coupons.service';

@Controller('admin/coupons')
@UseGuards(AdminGuard)
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list() { return this.coupons.list(); }

  @Post('generate')
  generate() { return this.coupons.generate(); }

  @Post()
  create(@Body() dto: CreateCouponDto) { return this.coupons.create(dto); }

  @Patch(':id')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.coupons.remove(id);
  }
}
