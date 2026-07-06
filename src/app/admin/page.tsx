import Link from 'next/link';

import { listAdminOrders, listAdminProducts } from '@/lib/admin-data';
import { summarizeAdminPricing } from '@/lib/admin-pricing';
import { formatMoney } from '@/lib/money';

export default async function AdminHomePage() {
  const [products, orders] = await Promise.all([
    listAdminProducts(),
    listAdminOrders(),
  ]);
  const lowStockProducts = products.filter(
    (product) => product.totalStock <= 3,
  );
  const pendingOrders = orders.filter((order) => order.status === 'pending');
  const activeProducts = products.filter(
    (product) => product.status === 'active',
  );
  const pricingSummary = summarizeAdminPricing(products);
  const pendingRevenueCents = pendingOrders.reduce(
    (total, order) => total + order.totalCents,
    0,
  );

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Visão geral</p>
          <h1>Painel administrativo</h1>
        </div>
        <div className="admin-heading-actions">
          <Link
            className="admin-primary-button"
            href="/admin/produtos/edicao-em-massa"
          >
            Ajustar valores
          </Link>
          <Link className="admin-ghost-button" href="/admin/produtos">
            Gerenciar produtos
          </Link>
        </div>
      </div>

      <div className="admin-metrics">
        <article>
          <span>Produtos ativos</span>
          <strong>{activeProducts.length}</strong>
        </article>
        <article>
          <span>Baixo estoque</span>
          <strong>{lowStockProducts.length}</strong>
        </article>
        <article>
          <span>Pedidos pendentes</span>
          <strong>{pendingOrders.length}</strong>
        </article>
        <article>
          <span>Receita pendente</span>
          <strong>{formatMoney(pendingRevenueCents)}</strong>
        </article>
      </div>

      <section className="admin-panel admin-value-spotlight">
        <div>
          <p>Central de valores</p>
          <h2>Preços, PIX e estoque em um lugar claro para operação manual.</h2>
        </div>
        <div className="admin-value-stats">
          <article>
            <span>Preço médio ativo</span>
            <strong>
              {formatMoney(pricingSummary.averageActivePriceCents)}
            </strong>
          </article>
          <article>
            <span>Valor em estoque</span>
            <strong>{formatMoney(pricingSummary.inventoryValueCents)}</strong>
          </article>
          <article>
            <span>Sem preço PIX</span>
            <strong>{pricingSummary.productsWithoutPixPrice}</strong>
          </article>
          <article>
            <span>Sem comparação</span>
            <strong>{pricingSummary.productsWithoutCompareAtPrice}</strong>
          </article>
        </div>
        <div className="admin-value-actions">
          <Link
            className="admin-primary-button"
            href="/admin/produtos/edicao-em-massa"
          >
            Editar vários valores
          </Link>
          <Link className="admin-ghost-button" href="/admin/produtos">
            Editar produto por produto
          </Link>
        </div>
      </section>

      <div className="admin-grid">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <h2>Pedidos recentes</h2>
            <Link href="/admin/pedidos">Ver todos</Link>
          </div>
          <div className="admin-list">
            {orders.slice(0, 8).map((order) => (
              <Link href={`/admin/pedidos/${order.orderNumber}`} key={order.id}>
                <span>{order.orderNumber}</span>
                <strong>{order.customerName}</strong>
                <small>{formatMoney(order.totalCents)}</small>
              </Link>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <h2>Estoque critico</h2>
            <Link href="/admin/produtos">Ajustar</Link>
          </div>
          <div className="admin-list">
            {lowStockProducts.slice(0, 8).map((product) => (
              <Link href={`/admin/produtos/${product.id}`} key={product.id}>
                <span>{product.totalStock} un.</span>
                <strong>{product.name}</strong>
                <small>{product.categoryName}</small>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
