import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class CreateBlogDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @Matches(/^(https:\/\/|\/images\/)[^\s]+$/, { each: true })
  supportingImages?: string[];
  @IsString()
  @MinLength(1, { message: 'სათაური სავალდებულოა' })
  title: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsString()
  @MinLength(1, { message: 'ტექსტი სავალდებულოა' })
  content: string;

  @IsString()
  @MinLength(1, { message: 'ფოტო სავალდებულოა' })
  image: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}
