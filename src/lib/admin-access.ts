export type AdminRole = 'owner' | 'admin' | 'operator';

/**
 * Identifies profiles that may enter the internal operation area.
 *
 * @example isAdminProfileActive(false)
 */
export function isAdminProfileActive(isActive: boolean): boolean {
  return isActive;
}

/**
 * Limits sensitive account controls to the store owner.
 *
 * @example canManageAdminAccounts('owner')
 */
export function canManageAdminAccounts(role: AdminRole): boolean {
  return role === 'owner';
}
