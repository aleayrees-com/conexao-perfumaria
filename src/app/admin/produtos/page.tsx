import Link from 'next/link';

import { ProductPixPriceField } from '@/components/admin/product-pix-price-field';
import { listAdminProducts } from '@/lib/admin-data';
import { createAdminProductPage } from '@/lib/admin-product-page';
import {
  calculateCardPriceCents,
  summarizeAdminPricing,
} from '@/lib/admin-pricing';
import { formatMoney } from '@/lib/money';

import { updateProductQuickAction } from './actions';

interface AdminProductsPageProps {
  readonly searchParams?: Promise<{
    readonly busca?: string;
    readonly pagina?: string;
    readonly status?: string;
  }>;
}

export default async function AdminProductsPage({
  searchParams,
}: AdminProductsPageProps) {
  const resolvedSearchParams = await searchParams;
  const products = await listAdminProducts();
  const searchTerm = resolvedSearchParams?.busca ?? '';
  const statusFilter = resolvedSearchParams?.status ?? '';
  const filteredProducts = products.filter((product) => {
    const matchesStatus = statusFilter ? product.status === statusFilter : true;

    return matchesStatus;
  });
  const productPage = createAdminProductPage(filteredProducts, {
    page: Number.parseInt(resolvedSearchParams?.pagina ?? '1', 10),
    pageSize: 25,
    searchTerm,
  });
  const pricingSummary = summarizeAdminPricing(productPage.items);

  return (
    <section className="admin-page admin-products-page">
      <div className="admin-products-heading">
        <div>
          <p className="admin-eyebrow">Catálogo</p>
          <h1>Produtos</h1>
          <span>Gerencie preços, disponibilidade e estoque da sua loja.</span>
        </div>
        <div className="admin-heading-actions">
          <Link className="admin-primary-button" href="/admin/produtos/novo">
            Novo produto
          </Link>
          <Link
            className="admin-ghost-button"
            href="/admin/produtos/edicao-em-massa"
          >
            Ações em massa
          </Link>
        </div>
      </div>

      <section className="admin-product-summary">
        <div>
          <p className="admin-eyebrow">Preço da loja</p>
          <h2>PIX é o valor principal.</h2>
          <span>O valor do cartão é calculado automaticamente em 7,54%.</span>
        </div>
        <dl>
          <div>
            <dt>Produtos</dt>
            <dd>{productPage.totalItems}</dd>
          </div>
          <div>
            <dt>Preço médio</dt>
            <dd>{formatMoney(pricingSummary.averageActivePriceCents)}</dd>
          </div>
          <div>
            <dt>Sem PIX</dt>
            <dd>{pricingSummary.productsWithoutPixPrice}</dd>
          </div>
        </dl>
      </section>

      <form className="admin-catalog-filters">
        <label>
          <span>Buscar</span>
          <input
            defaultValue={searchTerm}
            name="busca"
            placeholder="Nome, slug ou categoria"
            type="search"
          />
        </label>
        <label>
          <span>Status</span>
          <select defaultValue={statusFilter} name="status">
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="draft">Rascunhos</option>
            <option value="archived">Arquivados</option>
          </select>
        </label>
        <button className="admin-primary-button" type="submit">
          Aplicar filtros
        </button>
      </form>

      <div className="admin-catalog-table-wrap">
        <table className="admin-catalog-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Preço</th>
              <th>Estoque</th>
              <th>Status</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {productPage.items.map((product) => {
              const pixPriceCents = product.pixPriceCents ?? product.priceCents;
              const cardPriceCents = calculateCardPriceCents(pixPriceCents);

              return (
                <tr key={product.id}>
                  <td>
                    <div className="admin-product-identity">
                      <span aria-hidden="true">
                        {product.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <Link href={`/admin/produtos/${product.id}`}>
                          {product.name}
                        </Link>
                        <small>{product.slug}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="admin-category-chip">
                      {product.categoryName}
                    </span>
                  </td>
                  <td>
                    <div className="admin-price-stack">
                      <strong>{formatMoney(pixPriceCents)}</strong>
                      <span>PIX</span>
                      <small>Cartão: {formatMoney(cardPriceCents)}</small>
                    </div>
                  </td>
                  <td>
                    <div
                      className={
                        product.totalStock === 0
                          ? 'admin-stock-count admin-stock-empty'
                          : 'admin-stock-count'
                      }
                    >
                      <strong>{product.totalStock}</strong>
                      <span>unidades</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`admin-status admin-status-${product.status}`}
                    >
                      {product.status === 'active'
                        ? 'Ativo'
                        : product.status === 'draft'
                          ? 'Rascunho'
                          : 'Arquivado'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-product-actions">
                      <Link href={`/admin/produtos/${product.id}`}>Editar</Link>
                      <details className="admin-quick-price">
                        <summary>Ajustar PIX</summary>
                        <form action={updateProductQuickAction}>
                          <input
                            name="productId"
                            type="hidden"
                            value={product.id}
                          />
                          <ProductPixPriceField
                            defaultPixPriceCents={pixPriceCents}
                            inputName="pixPrice"
                            label="Preço PIX"
                          />
                          <label>
                            Status
                            <select defaultValue={product.status} name="status">
                              <option value="active">Ativo</option>
                              <option value="draft">Rascunho</option>
                              <option value="archived">Arquivado</option>
                            </select>
                          </label>
                          <button
                            className="admin-primary-button"
                            type="submit"
                          >
                            Salvar alterações
                          </button>
                        </form>
                      </details>
                    </div>
                  </td>
                </tr>
              );
            })}
            {productPage.items.length === 0 ? (
              <tr>
                <td className="admin-catalog-empty" colSpan={6}>
                  Nenhum produto encontrado com estes filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {productPage.totalPages > 1 ? (
        <nav aria-label="Paginação de produtos" className="admin-pagination">
          {productPage.page > 1 ? (
            <Link
              className="admin-ghost-button"
              href={`/admin/produtos?busca=${encodeURIComponent(searchTerm)}&status=${encodeURIComponent(statusFilter)}&pagina=${productPage.page - 1}`}
            >
              Anterior
            </Link>
          ) : null}
          <span>
            Página {productPage.page} de {productPage.totalPages}
          </span>
          {productPage.page < productPage.totalPages ? (
            <Link
              className="admin-ghost-button"
              href={`/admin/produtos?busca=${encodeURIComponent(searchTerm)}&status=${encodeURIComponent(statusFilter)}&pagina=${productPage.page + 1}`}
            >
              Próxima
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
