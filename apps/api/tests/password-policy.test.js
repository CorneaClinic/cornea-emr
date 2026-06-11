import { describe, it, expect } from 'vitest';
import { validatePasswordStrength, validateJwtSecretStrength } from '../src/core/password-policy.js';
import { ValidationError } from '../src/core/errors.js';

describe('validatePasswordStrength', () => {
  it('accepts a strong password', () => {
    expect(() => validatePasswordStrength('MySecurePass99')).not.toThrow();
  });

  it('rejects short passwords', () => {
    expect(() => validatePasswordStrength('Short1Aa')).toThrow(ValidationError);
  });

  it('rejects common passwords', () => {
    expect(() => validatePasswordStrength('admin1234567')).toThrow(ValidationError);
  });

  it('requires mixed case and a digit', () => {
    expect(() => validatePasswordStrength('alllowercase12')).toThrow(ValidationError);
    expect(() => validatePasswordStrength('ALLUPPERCASE12')).toThrow(ValidationError);
    expect(() => validatePasswordStrength('NoDigitsHereAa')).toThrow(ValidationError);
  });
});

describe('validateJwtSecretStrength', () => {
  it('accepts a long random secret', () => {
    expect(() => validateJwtSecretStrength('a'.repeat(48))).not.toThrow();
  });

  it('rejects short secrets', () => {
    expect(() => validateJwtSecretStrength('too-short')).toThrow();
  });

  it('rejects known weak values', () => {
    expect(() => validateJwtSecretStrength('dev-only-change-me-in-production')).toThrow();
  });
});
