import Link from 'next/link';

import { listAdminOrders } from '@/lib/admin-data';
import { formatMoney } from '@/lib/money';

export default async function AdminOrdersPage() {
  const orders = await listAdminOrders();

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Operação</p>
          <h1>Vendas e pedidos</h1>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Status</th>
              <th>Pagamento</th>
              <th>Total</th>
              <th>Origem</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link href={`/admin/pedidos/${order.orderNumber}`}>
                    {order.orderNumber}
                  </Link>
                  <small>
                    {new Date(order.createdAt).toLocaleString('pt-BR')}
                  </small>
                </td>
                <td>
                  {order.customerName}
                  {order.customerPhone ? (
                    <small>{order.customerPhone}</small>
                  ) : null}
                </td>
                <td>
                  <span className={`admin-status admin-status-${order.status}`}>
                    {order.status}
                  </span>
                </td>
                <td>
                  <span
                    className={`admin-status admin-status-${order.paymentStatus}`}
                  >
                    {order.paymentStatus}
                  </span>
                </td>
                <td>{formatMoney(order.totalCents)}</td>
                <td>{order.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
