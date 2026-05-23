'use client';

import { useMemo, useState, useEffect } from 'react';

import { ProductCard } from '@/components/product-card';
import { searchProducts } from '@/lib/catalog-utils';
import type { CategorySummary, Product } from '@/types/catalog';

export function CatalogClient({
  categories,
  initialOnlyAvailable = false,
  initialSearchTerm = '',
  products,
}: {
  readonly categories: readonly CategorySummary[];
  readonly initialOnlyAvailable?: boolean;
  readonly initialSearchTerm?: string;
  readonly products: readonly Product[];
}) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [debouncedSearchTerm, setDebouncedSearchTerm] =
    useState(initialSearchTerm);
  const [categorySlug, setCategorySlug] = useState('todos');
  const [onlyAvailable, setOnlyAvailable] = useState(initialOnlyAvailable);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const filteredProducts = useMemo(() => {
    const categoryFiltered =
      categorySlug === 'todos'
        ? products
        : products.filter((product) => product.category?.slug === categorySlug);
    const availabilityFiltered = onlyAvailable
      ? categoryFiltered.filter((product) => product.available)
      : categoryFiltered;

    return searchProducts(availabilityFiltered, debouncedSearchTerm);
  }, [categorySlug, debouncedSearchTerm, onlyAvailable, products]);

  return (
    <section className="catalog-section">
      <div className="catalog-toolbar">
        <label>
          Buscar fragrancia
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
                {category.name} ({category.productCount})
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-label">
          <input
            checked={onlyAvailable}
            type="checkbox"
            onChange={(event) => setOnlyAvailable(event.target.checked)}
          />
          So pronta entrega
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
