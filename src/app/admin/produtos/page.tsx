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
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Catálogo</p>
          <h1>Produtos</h1>
        </div>
        <div className="admin-heading-actions">
          <Link className="admin-primary-button" href="/admin/produtos/novo">
            Cadastrar produto
          </Link>
          <Link
            className="admin-primary-button"
            href="/admin/produtos/edicao-em-massa"
          >
            Ajustar valores em escala
          </Link>
        </div>
      </div>

      <section className="admin-panel admin-value-toolbar">
        <div>
          <p>PIX como valor principal</p>
          <h2>Informe o PIX; o valor do cartão é calculado automaticamente.</h2>
        </div>
        <div className="admin-value-toolbar-metrics">
          <span>{productPage.totalItems} produtos filtrados</span>
          <span>
            Média ativa: {formatMoney(pricingSummary.averageActivePriceCents)}
          </span>
          <span>{pricingSummary.productsWithoutPixPrice} sem PIX</span>
        </div>
      </section>

      <form className="admin-filter-bar">
        <input
          defaultValue={searchTerm}
          name="busca"
          placeholder="Buscar produto"
          type="search"
        />
        <select defaultValue={statusFilter} name="status">
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="draft">Rascunho</option>
          <option value="archived">Arquivado</option>
        </select>
        <button className="admin-primary-button" type="submit">
          Filtrar
        </button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Cartão</th>
              <th>PIX (principal)</th>
              <th>Estoque</th>
              <th>Edição rápida</th>
            </tr>
          </thead>
          <tbody>
            {productPage.items.map((product) => {
              const pixPriceCents = product.pixPriceCents ?? product.priceCents;
              const cardPriceCents = calculateCardPriceCents(pixPriceCents);

              return (
                <tr key={product.id}>
                  <td>
                    <Link href={`/admin/produtos/${product.id}`}>
                      {product.name}
                    </Link>
                    <small>{product.slug}</small>
                  </td>
                  <td>{product.categoryName}</td>
                  <td>
                    <span
                      className={`admin-status admin-status-${product.status}`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td>{formatMoney(cardPriceCents)}</td>
                  <td>{formatMoney(pixPriceCents)}</td>
                  <td>{product.totalStock}</td>
                  <td>
                    <form
                      className="admin-inline-form"
                      action={updateProductQuickAction}
                    >
                      <span className="admin-inline-form-title">Valores</span>
                      <input
                        name="productId"
                        type="hidden"
                        value={product.id}
                      />
                      <ProductPixPriceField
                        defaultPixPriceCents={pixPriceCents}
                        inputName="pixPrice"
                        label="PIX"
                      />
                      <select defaultValue={product.status} name="status">
                        <option value="active">Ativo</option>
                        <option value="draft">Rascunho</option>
                        <option value="archived">Arquivado</option>
                      </select>
                      <button className="admin-ghost-button" type="submit">
                        Salvar
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
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
