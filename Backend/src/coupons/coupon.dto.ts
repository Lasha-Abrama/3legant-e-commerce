import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateCouponDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  @Matches(/^[A-Z0-9]{8,12}$/, { message: 'Coupon codes must contain 8–12 letters or numbers.' })
  code: string;

  @IsInt()
  @Min(1)
  @Max(100)
  percentage: number;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  usageLimit?: number | null;

  @IsDateString({ strict: true })
  @MaxLength(40)
  expiresAt: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto, { skipNullProperties: false }) {}
