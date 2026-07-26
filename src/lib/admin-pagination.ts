import type {
  AdminProductSortDirection,
  AdminProductSortField,
} from './admin-product-page';

export interface AdminProductPageHrefInput {
  readonly page: number;
  readonly searchTerm: string;
  readonly sortDirection?: AdminProductSortDirection;
  readonly sortField?: AdminProductSortField;
  readonly statusFilter: string;
}

/**
 * Lists every page that can be selected in the product catalog.
 *
 * @example createAdminProductPaginationPages(3) // [1, 2, 3]
 */
export function createAdminProductPaginationPages(
  totalPages: number,
): number[] {
  return Array.from({ length: totalPages }, (_, index) => index + 1);
}

/**
 * Builds a catalog page link while retaining the active filters.
 *
 * @example createAdminProductPageHref({ page: 2, searchTerm: '', statusFilter: 'active' })
 */
export function createAdminProductPageHref(
  input: AdminProductPageHrefInput,
): string {
  const query = new URLSearchParams();

  if (input.searchTerm) query.set('busca', input.searchTerm);
  if (input.statusFilter) query.set('status', input.statusFilter);
  if (input.sortField) query.set('ordem', input.sortField);
  if (input.sortDirection) query.set('direcao', input.sortDirection);
  query.set('pagina', String(input.page));

  return `/admin/produtos?${query.toString()}`;
}

/**
 * Restricts a post-save redirect to the product catalog.
 *
 * @example resolveAdminProductReturnPath('/admin/produtos?pagina=2')
 */
export function resolveAdminProductReturnPath(value: string): string {
  return value === '/admin/produtos' || value.startsWith('/admin/produtos?')
    ? value
    : '/admin/produtos';
}
