import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsMongoId, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PRODUCT_CATEGORIES, ProductCategory } from '../schemas/product.schema';

const SORT_OPTIONS = ['price_asc', 'price_desc', 'newest', 'oldest'] as const;

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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.split(',').map((id) => id.trim()).filter(Boolean) : value)
  @IsArray()
  @ArrayMaxSize(50)
  @IsMongoId({ each: true })
  ids?: string[];

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
