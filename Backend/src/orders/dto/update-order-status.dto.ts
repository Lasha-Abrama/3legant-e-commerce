import { IsIn } from 'class-validator';
import { ORDER_STATUSES, OrderStatus } from '../schemas/order.schema';

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES, { message: `სტატუსი უნდა იყოს ერთ-ერთი: ${ORDER_STATUSES.join(', ')}` })
  status: OrderStatus;
}
