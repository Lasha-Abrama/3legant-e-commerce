import { IsEmail } from 'class-validator';

export class SubscribeDto {
  @IsEmail({}, { message: 'ელფოსტის ფორმატი არასწორია' })
  email: string;
}
