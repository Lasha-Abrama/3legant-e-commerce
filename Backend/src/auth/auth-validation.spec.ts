import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from '../users/dto/change-password.dto';

const validRegistration = { firstName: 'Test', lastName: 'User', email: 'user@example.com', password: 'strong-password' };

describe('Authentication input boundaries', () => {
  it.each([123, {}, [], null, '   ', 'a'.repeat(101)])('rejects invalid signup names (%j)', async (firstName) => {
    const errors = await validate(plainToInstance(RegisterDto, { ...validRegistration, firstName }));
    expect(errors.some(error => error.property === 'firstName')).toBe(true);
  });

  it('normalizes identity fields without trimming passwords', async () => {
    const dto = plainToInstance(RegisterDto, { ...validRegistration, firstName: ' Test ', email: ' USER@EXAMPLE.COM ', password: ' password ' });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ firstName: 'Test', email: 'user@example.com', password: ' password ' });
  });

  it('rejects passwords beyond bcrypt byte capacity on all password-setting endpoints', async () => {
    const password = '🔒'.repeat(19);
    for (const dto of [
      plainToInstance(RegisterDto, { ...validRegistration, password }),
      plainToInstance(ResetPasswordDto, { token: 'x'.repeat(43), password }),
      plainToInstance(ChangePasswordDto, { oldPassword: 'old-password', newPassword: password }),
    ]) expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('rejects non-string login passwords', async () => {
    expect((await validate(plainToInstance(LoginDto, { email: 'user@example.com', password: {} }))).length).toBeGreaterThan(0);
  });
});
