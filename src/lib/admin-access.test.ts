import { describe, expect, test } from 'vitest';

import {
  canCreateAdminAccount,
  canManageAdminAccounts,
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
