import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsMongoId,
  IsNumber,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @IsMongoId()
  productId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  color: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(1)
  qty: number;
}

export class OrderContactDto {
  @IsString()
  @MinLength(1, { message: 'სახელი სავალდებულოა' })
  firstName: string;

  @IsString()
  @MinLength(1, { message: 'გვარი სავალდებულოა' })
  lastName: string;

  @IsString()
  @MinLength(1, { message: 'ტელეფონის ნომერი სავალდებულოა' })
  phone: string;

  @IsEmail({}, { message: 'ელფოსტის ფორმატი არასწორია' })
  email: string;
}

export class OrderShippingAddressDto {
  @IsString()
  @MinLength(1, { message: 'მისამართი სავალდებულოა' })
  street: string;

  @IsString()
  @MinLength(1, { message: 'ქალაქი სავალდებულოა' })
  city: string;

  @IsString()
  @MinLength(1, { message: 'შტატი/რეგიონი სავალდებულოა' })
  state: string;

  @IsString()
  @MinLength(1, { message: 'საფოსტო ინდექსი სავალდებულოა' })
  zip: string;

  @IsString()
  @MinLength(1, { message: 'ქვეყანა სავალდებულოა' })
  country: string;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'კალათა ცარიელია' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ValidateNested()
  @Type(() => OrderContactDto)
  contact: OrderContactDto;

  @ValidateNested()
  @Type(() => OrderShippingAddressDto)
  shippingAddress: OrderShippingAddressDto;

  @IsIn(['card', 'paypal'])
  paymentMethod: 'card' | 'paypal';

  @IsIn(['free', 'express', 'pickup'])
  shippingOption: 'free' | 'express' | 'pickup';
}
