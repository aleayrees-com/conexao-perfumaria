import { describe, expect, test } from 'vitest';

import { getAdminPasswordError } from './admin-password';

describe('getAdminPasswordError', () => {
  test('accepts a compact password with letters, number and symbol', () => {
    expect(getAdminPasswordError('Conexao#26')).toBeNull();
  });

  test('rejects a password above the agreed fifteen-character limit', () => {
    expect(getAdminPasswordError('ConexaoSegura#26')).toContain('15');
  });
});
