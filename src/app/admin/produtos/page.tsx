import Link from 'next/link';

import { listAdminProducts } from '@/lib/admin-data';
import { summarizeAdminPricing } from '@/lib/admin-pricing';
import { formatMoney } from '@/lib/money';

import { updateProductQuickAction } from './actions';

interface AdminProductsPageProps {
  readonly searchParams?: Promise<{
    readonly busca?: string;
    readonly status?: string;
  }>;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default async function AdminProductsPage({
  searchParams,
}: AdminProductsPageProps) {
  const resolvedSearchParams = await searchParams;
  const products = await listAdminProducts();
  const searchTerm = resolvedSearchParams?.busca ?? '';
  const statusFilter = resolvedSearchParams?.status ?? '';
  const filteredProducts = products.filter((product) => {
    const matchesSearch = normalizeText(product.name).includes(
      normalizeText(searchTerm),
    );
    const matchesStatus = statusFilter ? product.status === statusFilter : true;

    return matchesSearch && matchesStatus;
  });
  const pricingSummary = summarizeAdminPricing(filteredProducts);

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Catálogo</p>
          <h1>Produtos</h1>
        </div>
        <div className="admin-heading-actions">
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
          <p>Valores manuais</p>
          <h2>Edite preço de venda, preço PIX e status sem sair do ADM.</h2>
        </div>
        <div className="admin-value-toolbar-metrics">
          <span>{filteredProducts.length} produtos filtrados</span>
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
              <th>Preço</th>
              <th>PIX</th>
              <th>Estoque</th>
              <th>Edição rápida</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
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
                <td>{formatMoney(product.priceCents)}</td>
                <td>
                  {product.pixPriceCents
                    ? formatMoney(product.pixPriceCents)
                    : '-'}
                </td>
                <td>{product.totalStock}</td>
                <td>
                  <form
                    className="admin-inline-form"
                    action={updateProductQuickAction}
                  >
                    <span className="admin-inline-form-title">Valores</span>
                    <input name="productId" type="hidden" value={product.id} />
                    <label>
                      Preço
                      <input
                        aria-label={`Preço de ${product.name}`}
                        defaultValue={(product.priceCents / 100).toFixed(2)}
                        name="price"
                      />
                    </label>
                    <label>
                      PIX
                      <input
                        aria-label={`Preço PIX de ${product.name}`}
                        defaultValue={
                          product.pixPriceCents
                            ? (product.pixPriceCents / 100).toFixed(2)
                            : ''
                        }
                        name="pixPrice"
                      />
                    </label>
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
