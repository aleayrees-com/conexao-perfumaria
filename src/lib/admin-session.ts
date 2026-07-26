export const ADMIN_SESSION_TTL_MS = 8 * 24 * 60 * 60 * 1000;

/**
 * Checks whether the trusted-device window is still open.
 *
 * @example isAdminSessionFresh(Date.now() - 1_000, Date.now())
 */
export function isAdminSessionFresh(issuedAt: number, now: number): boolean {
  if (!Number.isFinite(issuedAt) || !Number.isFinite(now)) {
    return false;
  }

  const sessionAge = now - issuedAt;

  return sessionAge >= 0 && sessionAge <= ADMIN_SESSION_TTL_MS;
}
