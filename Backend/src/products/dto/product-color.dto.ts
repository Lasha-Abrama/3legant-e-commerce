import { IsString, MinLength } from 'class-validator';

export class ProductColorDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  hex: string;
}
