import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBlogDto {
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
