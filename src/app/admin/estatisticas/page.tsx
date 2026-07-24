import Link from 'next/link';

import { listAdminOrders, listAdminProducts } from '@/lib/admin-data';
import { summarizeAdminSales } from '@/lib/admin-sales-statistics';
import { formatMoney } from '@/lib/money';

export default async function AdminStatisticsPage() {
  const [orders, products] = await Promise.all([
    listAdminOrders(),
    listAdminProducts(),
  ]);
  const sales = summarizeAdminSales(orders, new Date());
  const activeProducts = products.filter(
    (product) => product.status === 'active',
  );
  const outOfStockProducts = products.filter(
    (product) => product.totalStock === 0,
  );

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Inteligência da operação</p>
          <h1>Estatísticas</h1>
        </div>
        <Link className="admin-ghost-button" href="/admin/pedidos">
          Ver vendas
        </Link>
      </div>

      <div className="admin-metrics">
        <article>
          <span>Faturamento pago</span>
          <strong>{formatMoney(sales.paidRevenueCents)}</strong>
        </article>
        <article>
          <span>Faturamento no mês</span>
          <strong>{formatMoney(sales.currentMonthPaidRevenueCents)}</strong>
        </article>
        <article>
          <span>Ticket médio pago</span>
          <strong>{formatMoney(sales.averagePaidTicketCents)}</strong>
        </article>
        <article>
          <span>Pedidos pendentes</span>
          <strong>{sales.pendingOrderCount}</strong>
        </article>
      </div>

      <div className="admin-grid">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <h2>Vendas</h2>
          </div>
          <div className="admin-list">
            <div>
              <span>Pedidos totais</span>
              <strong>{sales.totalOrderCount}</strong>
            </div>
            <div>
              <span>Pedidos pagos</span>
              <strong>{sales.paidOrderCount}</strong>
            </div>
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-header">
            <h2>Catálogo</h2>
          </div>
          <div className="admin-list">
            <div>
              <span>Produtos ativos</span>
              <strong>{activeProducts.length}</strong>
            </div>
            <div>
              <span>Sem estoque</span>
              <strong>{outOfStockProducts.length}</strong>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
