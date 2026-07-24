export interface AdminProductPageItem {
  readonly categoryName: string;
  readonly id: string;
  readonly name: string;
  readonly pixPriceCents?: number | null;
  readonly priceCents?: number;
  readonly slug?: string;
  readonly status?: string;
  readonly totalStock?: number;
}

export type AdminProductSortDirection = 'asc' | 'desc';
export type AdminProductSortField =
  | 'category'
  | 'name'
  | 'price'
  | 'status'
  | 'stock';

export interface AdminProductPageInput {
  readonly page: number;
  readonly pageSize: number;
  readonly searchTerm: string;
  readonly sortDirection?: AdminProductSortDirection;
  readonly sortField?: AdminProductSortField;
}

export interface AdminProductPage<TItem extends AdminProductPageItem> {
  readonly items: readonly TItem[];
  readonly page: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

const catalogCollator = new Intl.Collator('pt-BR', {
  sensitivity: 'base',
});

function normalizeCatalogText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function matchesProductSearch(
  product: AdminProductPageItem,
  searchTerm: string,
): boolean {
  const normalizedSearch = normalizeCatalogText(searchTerm);

  return [product.name, product.categoryName, product.slug ?? ''].some(
    (value) => normalizeCatalogText(value).includes(normalizedSearch),
  );
}

function sortCatalogProducts<TItem extends AdminProductPageItem>(
  products: readonly TItem[],
  sortField: AdminProductSortField,
  sortDirection: AdminProductSortDirection,
): TItem[] {
  const multiplier = sortDirection === 'desc' ? -1 : 1;

  return [...products].sort(
    (first, second) =>
      compareCatalogProducts(first, second, sortField) * multiplier,
  );
}

function compareCatalogProducts(
  first: AdminProductPageItem,
  second: AdminProductPageItem,
  sortField: AdminProductSortField,
): number {
  if (sortField === 'price') {
    return getPixPriceCents(first) - getPixPriceCents(second);
  }

  if (sortField === 'stock') {
    return (first.totalStock ?? 0) - (second.totalStock ?? 0);
  }

  const firstValue =
    sortField === 'name' ? first.name : getTextSortValue(first, sortField);
  const secondValue =
    sortField === 'name' ? second.name : getTextSortValue(second, sortField);

  return (
    catalogCollator.compare(firstValue, secondValue) ||
    catalogCollator.compare(first.name, second.name)
  );
}

function getPixPriceCents(product: AdminProductPageItem): number {
  return product.pixPriceCents ?? product.priceCents ?? 0;
}

function getTextSortValue(
  product: AdminProductPageItem,
  sortField: 'category' | 'status',
): string {
  return sortField === 'category'
    ? product.categoryName
    : (product.status ?? '');
}

function normalizePageNumber(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * Converts a catalog query value into a supported sortable column.
 *
 * @example resolveAdminProductSortField('price') // 'price'
 */
export function resolveAdminProductSortField(
  value: string | undefined,
): AdminProductSortField {
  return value === 'name' ||
    value === 'price' ||
    value === 'stock' ||
    value === 'status'
    ? value
    : 'category';
}

/**
 * Converts a catalog query value into a sort direction.
 *
 * @example resolveAdminProductSortDirection('desc') // 'desc'
 */
export function resolveAdminProductSortDirection(
  value: string | undefined,
): AdminProductSortDirection {
  return value === 'desc' ? 'desc' : 'asc';
}

export function createAdminProductPage<TItem extends AdminProductPageItem>(
  products: readonly TItem[],
  input: AdminProductPageInput,
): AdminProductPage<TItem> {
  const filteredProducts = products.filter((product) =>
    matchesProductSearch(product, input.searchTerm),
  );
  const pageSize = normalizePageNumber(input.pageSize, 25);
  const sortField = input.sortField ?? 'category';
  const sortDirection = input.sortDirection ?? 'asc';
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const page = Math.min(normalizePageNumber(input.page, 1), totalPages);
  const offset = (page - 1) * pageSize;

  return {
    items: sortCatalogProducts(
      filteredProducts,
      sortField,
      sortDirection,
    ).slice(offset, offset + pageSize),
    page,
    totalItems: filteredProducts.length,
    totalPages,
  };
}
