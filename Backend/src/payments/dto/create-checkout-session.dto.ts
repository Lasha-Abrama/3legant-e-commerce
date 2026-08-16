import { IsMongoId } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsMongoId()
  orderId: string;
}
