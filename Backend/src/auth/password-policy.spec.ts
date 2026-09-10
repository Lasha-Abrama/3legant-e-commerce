import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createContext, runInContext } from 'vm';
import { TextEncoder } from 'util';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from '../users/dto/change-password.dto';

describe('Password policy consistency', () => {
  const browser: any = createContext({ window: {}, TextEncoder });
  runInContext(readFileSync(resolve(__dirname, '../../../Frontend/js/password-policy.js'), 'utf8'), browser);
  const missing = (value: string): string[] => browser.window.PasswordPolicy.missing(value);

  it.each(['', 'abc', 'abcdefgh', 'Abcdefgh', 'Abcdefg1', 'Abcdef1!', 'PASSWORD1!',
    'Password!', 'Password1 ', ' Password1! ', 'Abcdef1🔒', 'A1!' + 'é'.repeat(35)])(
    'returns identical missing requirements in browser and all three backend DTOs for %p', async (password) => {
      for (const dto of [
        plainToInstance(RegisterDto, { firstName: 'Test', lastName: 'User', email: 'test@example.com', password }),
        plainToInstance(ResetPasswordDto, { token: 't'.repeat(43), password }),
        plainToInstance(ChangePasswordDto, { oldPassword: 'legacy-password', newPassword: password }),
      ]) {
        const errors = await validate(dto);
        const messages = errors.flatMap(error => Object.values(error.constraints || {}));
        expect(messages.sort()).toEqual(Array.from(missing(password)).sort());
      }
    },
  );

  it('removes requirements individually as the password improves', () => {
    expect(missing('abcdefgh')).toHaveLength(3);
    expect(missing('Abcdefgh')).toHaveLength(2);
    expect(missing('Abcdefg1')).toEqual(['Add a special character, such as !, @, or #.']);
    expect(missing('Abcdef1!')).toEqual([]);
  });

  it('does not impose the new policy on an existing login password', async () => {
    const { LoginDto } = await import('./dto/login.dto');
    expect(await validate(plainToInstance(LoginDto, { email: 'test@example.com', password: 'legacy-password' }))).toEqual([]);
  });
});
