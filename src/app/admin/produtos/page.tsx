import Link from 'next/link';

import { ProductPriceTable } from '@/components/admin/product-price-table';
import { listAdminProducts } from '@/lib/admin-data';
import {
  createAdminProductPageHref,
  createAdminProductPaginationPages,
} from '@/lib/admin-pagination';
import { createAdminProductPage } from '@/lib/admin-product-page';
import { summarizeAdminPricing } from '@/lib/admin-pricing';
import { formatMoney } from '@/lib/money';

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
  const paginationPages = createAdminProductPaginationPages(
    productPage.totalPages,
  );
  const createPageHref = (page: number) =>
    createAdminProductPageHref({
      page,
      searchTerm,
      statusFilter,
    });
  const currentCatalogHref = createPageHref(productPage.page);

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

      {productPage.items.length === 0 ? (
        <div className="admin-catalog-table-wrap">
          <p className="admin-catalog-empty">
            Nenhum produto encontrado com estes filtros.
          </p>
        </div>
      ) : (
        <ProductPriceTable
          products={productPage.items}
          returnTo={currentCatalogHref}
        />
      )}

      {productPage.totalPages > 1 ? (
        <nav aria-label="Paginação de produtos" className="admin-pagination">
          {productPage.page > 1 ? (
            <Link
              className="admin-pagination-boundary"
              href={createPageHref(productPage.page - 1)}
            >
              Anterior
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="admin-pagination-boundary is-disabled"
            >
              Anterior
            </span>
          )}
          <div className="admin-pagination-pages">
            {paginationPages.map((page) => (
              <Link
                aria-current={page === productPage.page ? 'page' : undefined}
                className="admin-pagination-page"
                href={createPageHref(page)}
                key={page}
              >
                {page}
              </Link>
            ))}
          </div>
          {productPage.page < productPage.totalPages ? (
            <Link
              className="admin-pagination-boundary"
              href={createPageHref(productPage.page + 1)}
            >
              Próxima
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="admin-pagination-boundary is-disabled"
            >
              Próxima
            </span>
          )}
        </nav>
      ) : null}
    </section>
  );
}
