import { getAdminPasswordError } from '@/lib/admin-password';

export type AdminRole = 'owner' | 'admin' | 'operator';

const MAX_ADMIN_ACCOUNTS = 3;

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

/**
 * Keeps the panel restricted to the three people approved for this store.
 *
 * @example canCreateAdminAccount(2)
 */
export function canCreateAdminAccount(profileCount: number): boolean {
  return profileCount < MAX_ADMIN_ACCOUNTS;
}

/**
 * Translates known account-form failures into a clear message for the team.
 *
 * @example getAdminAccessErrorMessage('password')
 */
export function getAdminAccessErrorMessage(
  error: string | undefined,
): string | null {
  if (error === 'password') {
    return 'Revise a senha: use 8 a 15 caracteres, letras maiúsculas e minúsculas, número e símbolo.';
  }

  return null;
}

/**
 * Validates both password fields before an access form leaves the browser.
 *
 * @example getAdminAccessPasswordError('Conexao#26', 'Conexao#26')
 */
export function getAdminAccessPasswordError(
  password: string,
  passwordConfirmation: string,
): string | null {
  const passwordError = getAdminPasswordError(password);

  if (passwordError) {
    return passwordError;
  }

  return password === passwordConfirmation
    ? null
    : 'A confirmação de senha não confere.';
}
