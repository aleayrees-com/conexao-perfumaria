import type {
  AdminProductSortDirection,
  AdminProductSortField,
} from './admin-product-page';

export const adminProductSortStorageKey = 'conexao.admin.products.sort';

export interface AdminProductSortPreference {
  readonly direction: AdminProductSortDirection;
  readonly field: AdminProductSortField;
}

function isAdminProductSortPreference(
  value: unknown,
): value is AdminProductSortPreference {
  if (typeof value !== 'object' || value === null) return false;

  const preference = value as Record<string, unknown>;
  const validField = ['category', 'name', 'price', 'status', 'stock'].includes(
    String(preference.field),
  );

  return validField && ['asc', 'desc'].includes(String(preference.direction));
}

/**
 * Reads a persisted catalog order only when it has the supported shape.
 *
 * @example parseAdminProductSortPreference('{"field":"price","direction":"desc"}')
 */
export function parseAdminProductSortPreference(
  value: string,
): AdminProductSortPreference | null {
  try {
    const preference: unknown = JSON.parse(value);

    return isAdminProductSortPreference(preference) ? preference : null;
  } catch {
    return null;
  }
}

/**
 * Applies an order to a catalog URL and starts on its first results page.
 *
 * @example createAdminProductSortHref('/admin/produtos?pagina=2', { field: 'name', direction: 'asc' })
 */
export function createAdminProductSortHref(
  returnTo: string,
  preference: AdminProductSortPreference,
): string {
  const [pathname, queryString = ''] = returnTo.split('?', 2);
  const query = new URLSearchParams(queryString);

  query.set('pagina', '1');
  query.set('ordem', preference.field);
  query.set('direcao', preference.direction);

  return `${pathname}?${query.toString()}`;
}
