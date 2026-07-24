'use client';

import Link from 'next/link';
import { useState } from 'react';

import { updateProductPricesAction } from '@/app/admin/produtos/actions';
import type { AdminProductSummary } from '@/lib/admin-data';
import { updateAdminPriceChanges } from '@/lib/admin-quick-prices';

import { ProductPixPriceField } from './product-pix-price-field';

interface ProductPriceTableProps {
  readonly products: readonly AdminProductSummary[];
  readonly returnTo: string;
}

function getProductPixPriceCents(product: AdminProductSummary): number {
  return product.pixPriceCents ?? product.priceCents;
}

function ProductStockCount({ stock }: { readonly stock: number }) {
  const stockClassName =
    stock === 0 ? 'admin-stock-count admin-stock-empty' : 'admin-stock-count';

  return (
    <div className={stockClassName}>
      <strong>{stock}</strong>
      <span>unidades</span>
    </div>
  );
}

function ProductStatus({ status }: { readonly status: string }) {
  const label =
    status === 'active'
      ? 'Ativo'
      : status === 'draft'
        ? 'Rascunho'
        : 'Arquivado';

  return <span className={`admin-status admin-status-${status}`}>{label}</span>;
}

function ProductPriceRow({
  product,
  onPriceChange,
}: {
  readonly product: AdminProductSummary;
  readonly onPriceChange: (
    product: AdminProductSummary,
    priceCents: number,
  ) => void;
}) {
  const pixPriceCents = getProductPixPriceCents(product);

  return (
    <tr>
      <td>
        <div className="admin-product-identity">
          <span aria-hidden="true">
            {product.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <Link href={`/admin/produtos/${product.id}`}>{product.name}</Link>
            <small>{product.slug}</small>
          </div>
        </div>
      </td>
      <td>
        <span className="admin-category-chip">{product.categoryName}</span>
      </td>
      <td>
        <div className="admin-inline-price-form">
          <ProductPixPriceField
            defaultPixPriceCents={pixPriceCents}
            inputName={`pixPrice:${product.id}`}
            label="PIX (principal)"
            onPixPriceCentsChange={(priceCents) =>
              onPriceChange(product, priceCents)
            }
          />
        </div>
      </td>
      <td>
        <ProductStockCount stock={product.totalStock} />
      </td>
      <td>
        <ProductStatus status={product.status} />
      </td>
      <td>
        <Link
          className="admin-product-edit-link"
          href={`/admin/produtos/${product.id}`}
        >
          Editar
        </Link>
      </td>
    </tr>
  );
}

function ProductPriceSaveFloat({ count }: { readonly count: number }) {
  const saveLabel = count === 1 ? 'Salvar' : `Salvar em massa (${count})`;
  const detail = count === 1 ? '1 preço alterado' : `${count} preços alterados`;

  return (
    <div aria-live="polite" className="admin-price-save-float">
      <span>{detail}</span>
      <button className="admin-primary-button" type="submit">
        {saveLabel}
      </button>
    </div>
  );
}

/**
 * Allows price changes across the current catalog page in one save action.
 *
 * @example <ProductPriceTable products={[]} returnTo="/admin/produtos" />
 */
export function ProductPriceTable({
  products,
  returnTo,
}: ProductPriceTableProps) {
  const [changedPriceCents, setChangedPriceCents] = useState<
    Record<string, number>
  >({});
  const changedProductIds = Object.keys(changedPriceCents);

  function handlePriceChange(
    product: AdminProductSummary,
    nextPriceCents: number,
  ) {
    setChangedPriceCents((changes) =>
      updateAdminPriceChanges(
        changes,
        product.id,
        getProductPixPriceCents(product),
        nextPriceCents,
      ),
    );
  }

  return (
    <form
      action={updateProductPricesAction}
      className="admin-product-price-batch"
    >
      <input name="returnTo" type="hidden" value={returnTo} />
      {changedProductIds.map((productId) => (
        <input
          key={productId}
          name="dirtyProductId"
          type="hidden"
          value={productId}
        />
      ))}
      <div className="admin-catalog-table-wrap">
        <table className="admin-catalog-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Preço PIX</th>
              <th>Estoque</th>
              <th>Status</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <ProductPriceRow
                key={product.id}
                onPriceChange={handlePriceChange}
                product={product}
              />
            ))}
          </tbody>
        </table>
      </div>
      {changedProductIds.length > 0 ? (
        <ProductPriceSaveFloat count={changedProductIds.length} />
      ) : null}
    </form>
  );
}
