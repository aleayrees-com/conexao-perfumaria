import type { CategorySummary, Product } from '@/types/catalog';

export function sortFeaturedProducts(
  products: readonly Product[],
  limit = 12,
): readonly Product[] {
  return [...products]
    .sort((left, right) => {
      if (left.available !== right.available) {
        return left.available ? -1 : 1;
      }

      return right.priceCents - left.priceCents;
    })
    .slice(0, limit);
}

export function buildCategorySummaries(
  products: readonly Product[],
): readonly CategorySummary[] {
  const categories = new Map<string, CategorySummary>();

  for (const product of products) {
    if (!product.category) {
      continue;
    }

    const current = categories.get(product.category.slug);
    categories.set(product.category.slug, {
      ...product.category,
      productCount: (current?.productCount ?? 0) + 1,
      availableCount:
        (current?.availableCount ?? 0) + (product.available ? 1 : 0),
    });
  }

  return [...categories.values()].sort((left, right) =>
    left.name.localeCompare(right.name, 'pt-BR'),
  );
}

export function searchProducts(
  items: readonly Product[],
  searchTerm: string,
): readonly Product[] {
  const query = searchTerm.trim().toLocaleLowerCase('pt-BR');

  if (!query) {
    return items;
  }

  return items.filter((product) => {
    const text = [
      product.name,
      product.description,
      product.category?.name ?? '',
      ...product.variants.map((variant) => variant.label),
    ]
      .join(' ')
      .toLocaleLowerCase('pt-BR');

    return text.includes(query);
  });
}
