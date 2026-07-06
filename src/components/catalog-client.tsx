'use client';

import { useMemo, useState, useEffect } from 'react';

import { ProductCard } from '@/components/product-card';
import { filterCatalogProducts } from '@/lib/catalog-utils';
import { formatPortugueseDisplayText } from '@/lib/strings';
import type { CategorySummary, Product } from '@/types/catalog';

export function CatalogClient({
  categories,
  initialMaxPriceCents = null,
  initialOnlyAvailable = false,
  initialSearchTerm = '',
  products,
}: {
  readonly categories: readonly CategorySummary[];
  readonly initialMaxPriceCents?: number | null;
  readonly initialOnlyAvailable?: boolean;
  readonly initialSearchTerm?: string;
  readonly products: readonly Product[];
}) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [debouncedSearchTerm, setDebouncedSearchTerm] =
    useState(initialSearchTerm);
  const [categorySlug, setCategorySlug] = useState('todos');
  const [onlyAvailable, setOnlyAvailable] = useState(initialOnlyAvailable);
  const [maxPriceCents, setMaxPriceCents] = useState<number | null>(
    initialMaxPriceCents,
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const filteredProducts = useMemo(() => {
    return filterCatalogProducts(products, {
      categorySlug,
      maxPriceCents,
      onlyAvailable,
      searchTerm: debouncedSearchTerm,
    });
  }, [
    categorySlug,
    debouncedSearchTerm,
    maxPriceCents,
    onlyAvailable,
    products,
  ]);

  return (
    <section className="catalog-section">
      <div className="catalog-toolbar">
        <label>
          Buscar fragrância
          <input
            placeholder="Ex.: Yara, Vanilla, Lattafa..."
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
        <label>
          Categoria
          <select
            value={categorySlug}
            onChange={(event) => setCategorySlug(event.target.value)}
          >
            <option value="todos">Todas</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {formatPortugueseDisplayText(category.name)} (
                {category.productCount})
              </option>
            ))}
          </select>
        </label>
        <label>
          Valor
          <select
            value={maxPriceCents ?? 'todos'}
            onChange={(event) => {
              setMaxPriceCents(
                event.target.value === 'todos'
                  ? null
                  : Number(event.target.value),
              );
            }}
          >
            <option value="todos">Todos</option>
            <option value={15000}>Até R$150</option>
            <option value={25000}>Até R$250</option>
            <option value={35000}>Até R$350</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            checked={onlyAvailable}
            type="checkbox"
            onChange={(event) => setOnlyAvailable(event.target.checked)}
          />
          Só pronta entrega
        </label>
      </div>

      <div className="catalog-count">
        {filteredProducts.length} produto
        {filteredProducts.length === 1 ? '' : 's'}
      </div>

      {filteredProducts.length > 0 ? (
        <div className="product-grid">
          {filteredProducts.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      ) : (
        <div className="empty-state wide">
          <p>Nenhum produto bateu com esse filtro.</p>
          <button
            className="button ghost"
            type="button"
            onClick={() => {
              setSearchTerm('');
              setCategorySlug('todos');
              setMaxPriceCents(null);
              setOnlyAvailable(false);
            }}
          >
            Limpar filtros
          </button>
        </div>
      )}
    </section>
  );
}
