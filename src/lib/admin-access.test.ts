import { describe, expect, test } from 'vitest';

import {
  canCreateAdminAccount,
  canManageAdminAccounts,
  getAdminAccessErrorMessage,
  getAdminAccessPasswordError,
  isAdminProfileActive,
} from './admin-access';

describe('isAdminProfileActive', () => {
  test('allows a profile explicitly kept active', () => {
    expect(isAdminProfileActive(true)).toBe(true);
  });

  test('blocks a deactivated profile immediately', () => {
    expect(isAdminProfileActive(false)).toBe(false);
  });
});

describe('canManageAdminAccounts', () => {
  test('reserves account management for the owner', () => {
    expect(canManageAdminAccounts('owner')).toBe(true);
    expect(canManageAdminAccounts('operator')).toBe(false);
  });
});

describe('canCreateAdminAccount', () => {
  test('limits the store to the three agreed people', () => {
    expect(canCreateAdminAccount(2)).toBe(true);
    expect(canCreateAdminAccount(3)).toBe(false);
  });
});

describe('getAdminAccessErrorMessage', () => {
  test('explains the temporary password policy without failing the page', () => {
    expect(getAdminAccessErrorMessage('password')).toBe(
      'Revise a senha: use 8 a 15 caracteres, letras maiúsculas e minúsculas, número e símbolo.',
    );
  });

  test('ignores unknown access error codes', () => {
    expect(getAdminAccessErrorMessage('unexpected')).toBeNull();
  });
});

describe('getAdminAccessPasswordError', () => {
  test('returns a validation message instead of requiring a page redirect', () => {
    expect(getAdminAccessPasswordError('Conexao#26', 'Outra#26')).toBe(
      'A confirmação de senha não confere.',
    );
  });
});
