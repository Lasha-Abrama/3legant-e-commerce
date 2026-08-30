import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { PaymentsService } from './payments.service';

@Controller('admin/payments')
@UseGuards(AdminGuard)
export class PaymentsAdminController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('orders/:orderId/refund')
  refundOrder(@Param('orderId', ParseObjectIdPipe) orderId: string) {
    return this.paymentsService.createRefund(orderId);
  }
}
