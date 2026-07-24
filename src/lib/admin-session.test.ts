import { describe, expect, test } from 'vitest';

import { ADMIN_SESSION_TTL_MS, isAdminSessionFresh } from './admin-session';

describe('isAdminSessionFresh', () => {
  test('keeps an authenticated device for eight days', () => {
    const now = new Date('2026-07-24T12:00:00.000Z').getTime();
    const issuedAt = now - ADMIN_SESSION_TTL_MS + 1;

    expect(isAdminSessionFresh(issuedAt, now)).toBe(true);
  });

  test('expires a session that is older than eight days', () => {
    const now = new Date('2026-07-24T12:00:00.000Z').getTime();
    const issuedAt = now - ADMIN_SESSION_TTL_MS - 1;

    expect(isAdminSessionFresh(issuedAt, now)).toBe(false);
  });
});
