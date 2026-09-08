import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

export class SubscribeDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsEmail({}, { message: 'ელფოსტის ფორმატი არასწორია' })
  @MaxLength(254, { message: 'ელფოსტა არ უნდა აღემატებოდეს 254 სიმბოლოს' })
  email: string;
}
