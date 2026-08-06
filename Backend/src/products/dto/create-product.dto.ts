import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PRODUCT_CATEGORIES, ProductCategory } from '../schemas/product.schema';
import { ProductColorDto } from './product-color.dto';

export class CreateProductDto {
  @IsString()
  @MinLength(1, { message: 'პროდუქტის სახელი სავალდებულოა' })
  name: string;

  @IsIn(PRODUCT_CATEGORIES, { message: `კატეგორია უნდა იყოს ერთ-ერთი: ${PRODUCT_CATEGORIES.join(', ')}` })
  category: ProductCategory;

  @IsNumber()
  @Min(0, { message: 'ფასი არ შეიძლება იყოს უარყოფითი' })
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductColorDto)
  colors?: ProductColorDto[];

  @IsOptional()
  @IsBoolean()
  newArrival?: boolean;

  @IsOptional()
  @IsString()
  discountLabel?: string;

  @IsString()
  @MinLength(1, { message: 'SKU სავალდებულოა' })
  sku: string;

  @IsOptional()
  @IsString()
  measurements?: string;

  @IsString()
  @MinLength(1, { message: 'აღწერა სავალდებულოა' })
  description: string;

  @IsString()
  @MinLength(1, { message: 'სურათის ლეიბლი სავალდებულოა' })
  imageLabel: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;
}
