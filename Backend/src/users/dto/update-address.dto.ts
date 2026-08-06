import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAddressDto {
  @IsIn(['billing', 'shipping'], { message: 'მისამართის ტიპი უნდა იყოს billing ან shipping' })
  type: 'billing' | 'shipping';

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zip?: string;

  @IsOptional()
  @IsString()
  country?: string;
}
