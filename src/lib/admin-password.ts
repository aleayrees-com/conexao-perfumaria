const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 15;

/**
 * Returns the readable policy violation for an admin password, when present.
 *
 * @example getAdminPasswordError('Conexao#26')
 */
export function getAdminPasswordError(password: string): string | null {
  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return `A senha deve ter entre ${MIN_PASSWORD_LENGTH} e ${MAX_PASSWORD_LENGTH} caracteres.`;
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return 'A senha deve misturar letras maiúsculas e minúsculas.';
  }

  if (!/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'A senha deve incluir ao menos um número e um símbolo.';
  }

  return null;
}
