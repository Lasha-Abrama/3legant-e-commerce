import { applyDecorators } from '@nestjs/common';
import { IsByteLength, IsString, MinLength, ValidateBy } from 'class-validator';

function characterRule(name: string, pattern: RegExp, message: string) {
  return ValidateBy({ name, validator: {
    validate: (value: unknown) => typeof value === 'string' && pattern.test(value),
    defaultMessage: () => message,
  } });
}

// Keep the browser rules in Frontend/js/password-policy.js in sync (parity tested).
export function StrongPassword() {
  return applyDecorators(
    IsString(),
    MinLength(8, { message: 'Use at least 8 characters.' }),
    characterRule('passwordUppercase', /[A-Z]/, 'Add an uppercase letter (A–Z).'),
    characterRule('passwordLowercase', /[a-z]/, 'Add a lowercase letter (a–z).'),
    characterRule('passwordNumber', /[0-9]/, 'Add a number (0–9).'),
    characterRule('passwordSpecial', /[\p{P}\p{S}]/u, 'Add a special character, such as !, @, or #.'),
    IsByteLength(0, 72, { message: 'Use no more than 72 UTF-8 bytes.' }),
  );
}
