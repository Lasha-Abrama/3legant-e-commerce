import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { UsersModule } from '../users/users.module';
import { PaymentsController } from './payments.controller';
import { PaymentsAdminController } from './payments-admin.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [OrdersModule, UsersModule],
  controllers: [PaymentsController, PaymentsAdminController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
