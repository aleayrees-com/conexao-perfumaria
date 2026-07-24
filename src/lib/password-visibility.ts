export interface PasswordVisibilityCopy {
  readonly label: 'Mostrar senha' | 'Ocultar senha';
  readonly type: 'password' | 'text';
}

/**
 * Supplies the accessible label and input type for the password eye control.
 *
 * @example getPasswordVisibilityCopy(true)
 */
export function getPasswordVisibilityCopy(
  isRevealed: boolean,
): PasswordVisibilityCopy {
  return isRevealed
    ? { label: 'Ocultar senha', type: 'text' }
    : { label: 'Mostrar senha', type: 'password' };
}
