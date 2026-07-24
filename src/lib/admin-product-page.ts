export interface AdminProductPageItem {
  readonly categoryName: string;
  readonly id: string;
  readonly name: string;
  readonly slug?: string;
}

export interface AdminProductPageInput {
  readonly page: number;
  readonly pageSize: number;
  readonly searchTerm: string;
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
): TItem[] {
  return [...products].sort(
    (first, second) =>
      catalogCollator.compare(first.categoryName, second.categoryName) ||
      catalogCollator.compare(first.name, second.name),
  );
}

function normalizePageNumber(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function createAdminProductPage<TItem extends AdminProductPageItem>(
  products: readonly TItem[],
  input: AdminProductPageInput,
): AdminProductPage<TItem> {
  const filteredProducts = products.filter((product) =>
    matchesProductSearch(product, input.searchTerm),
  );
  const pageSize = normalizePageNumber(input.pageSize, 25);
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const page = Math.min(normalizePageNumber(input.page, 1), totalPages);
  const offset = (page - 1) * pageSize;

  return {
    items: sortCatalogProducts(filteredProducts).slice(
      offset,
      offset + pageSize,
    ),
    page,
    totalItems: filteredProducts.length,
    totalPages,
  };
}
