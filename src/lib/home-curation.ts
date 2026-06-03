import type { Product } from '@/types/catalog';

const preferredFeaturedTerms = [
  'yara',
  'yara moi',
  'asad',
  'khamrah',
  'fakhar',
  'ameerat al arab',
  'sabah al ward',
  'hayaati',
] as const;

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasProductImage(product: Product): boolean {
  return Boolean(product.imageUrls[0]);
}

function productMatchesTerm(product: Product, term: string): boolean {
  const searchable = normalizeText(
    [product.name, product.description, product.category?.name ?? ''].join(' '),
  );

  return searchable.includes(normalizeText(term));
}

export function selectHomeFeaturedProducts(
  products: readonly Product[],
  limit = 8,
): readonly Product[] {
  const availableProducts = products.filter(
    (product) => product.available && hasProductImage(product),
  );
  const selectedProducts: Product[] = [];

  for (const term of preferredFeaturedTerms) {
    const match = availableProducts.find(
      (product) =>
        productMatchesTerm(product, term) &&
        !selectedProducts.some((selected) => selected.slug === product.slug),
    );

    if (match) {
      selectedProducts.push(match);
    }
  }

  for (const product of availableProducts) {
    if (selectedProducts.length >= limit) {
      break;
    }

    if (!selectedProducts.some((selected) => selected.slug === product.slug)) {
      selectedProducts.push(product);
    }
  }

  return selectedProducts.slice(0, limit);
}
