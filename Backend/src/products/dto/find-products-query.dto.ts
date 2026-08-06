import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PRODUCT_CATEGORIES, ProductCategory } from '../schemas/product.schema';

const SORT_OPTIONS = ['price_asc', 'price_desc', 'newest'] as const;

export class FindProductsQueryDto {
  @IsOptional()
  @IsIn(PRODUCT_CATEGORIES)
  category?: ProductCategory;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  newArrival?: boolean;

  @IsOptional()
  @IsIn(SORT_OPTIONS)
  sort?: (typeof SORT_OPTIONS)[number];

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number = 12;
}
