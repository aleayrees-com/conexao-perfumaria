export interface AdminProductPageHrefInput {
  readonly page: number;
  readonly searchTerm: string;
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
  query.set('pagina', String(input.page));

  return `/admin/produtos?${query.toString()}`;
}
