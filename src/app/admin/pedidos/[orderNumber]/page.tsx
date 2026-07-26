import { notFound } from 'next/navigation';

import {
  getAdminOrder,
  type AdminOrderShippingAddress,
} from '@/lib/admin-data';
import { formatMoney } from '@/lib/money';

import { updateOrderAction } from '../actions';

interface AdminOrderPageProps {
  readonly params: Promise<{
    readonly orderNumber: string;
  }>;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  cancelled: 'Cancelado',
  confirmed: 'Confirmado',
  delivered: 'Entregue',
  pending: 'Pendente',
  processing: 'Em separação',
  refunded: 'Reembolsado',
  shipped: 'Enviado',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  cancelled: 'Cancelado',
  failed: 'Falhou',
  paid: 'Pago',
  pending: 'Pendente',
  refunded: 'Reembolsado',
  unpaid: 'Não pago',
};

function formatDeliveryWindow(
  minDays: number | null,
  maxDays: number | null,
): string {
  if (minDays !== null && maxDays !== null) {
    return minDays === maxDays
      ? `${minDays} dia útil`
      : `${minDays} a ${maxDays} dias úteis`;
  }

  if (maxDays !== null) {
    return `até ${maxDays} dias úteis`;
  }

  return 'Prazo a confirmar';
}

function formatAddress(address: AdminOrderShippingAddress): string {
  return [
    [address.street, address.number].filter(Boolean).join(', '),
    address.complement,
    address.neighborhood,
    [address.city, address.state].filter(Boolean).join(' - '),
    address.cep ? `CEP ${address.cep}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export default async function AdminOrderPage({ params }: AdminOrderPageProps) {
  const { orderNumber } = await params;
  const order = await getAdminOrder(orderNumber);

  if (!order) {
    notFound();
  }

  return (
    <section className="admin-page admin-order-page">
      <div className="admin-order-hero">
        <div>
          <p>Pedido</p>
          <h1>{order.orderNumber}</h1>
          <span>
            {order.customerName} · {formatMoney(order.totalCents)}
          </span>
        </div>
        <div className="admin-order-hero-metrics">
          <article>
            <span>Status</span>
            <strong>{ORDER_STATUS_LABELS[order.status] ?? order.status}</strong>
          </article>
          <article>
            <span>Pagamento</span>
            <strong>
              {PAYMENT_STATUS_LABELS[order.paymentStatus] ??
                order.paymentStatus}
            </strong>
          </article>
          <article>
            <span>Total</span>
            <strong>{formatMoney(order.totalCents)}</strong>
          </article>
        </div>
      </div>

      <div className="admin-order-layout">
        <div className="admin-order-stack">
          <section className="admin-panel admin-order-card">
            <div className="admin-panel-header">
              <div>
                <p>Resumo</p>
                <h2>Itens do pedido</h2>
              </div>
            </div>
            <div className="admin-order-items">
              {order.items.map((item) => (
                <article className="admin-order-item" key={item.id}>
                  <div className="admin-order-item-title">
                    <strong>{item.productName}</strong>
                    <span>{item.variantLabel}</span>
                  </div>
                  <small>
                    {item.quantity} x {formatMoney(item.unitPriceCents)}
                  </small>
                  <b>{formatMoney(item.lineTotalCents)}</b>
                </article>
              ))}
            </div>
            <div className="admin-order-total">
              <span>Subtotal</span>
              <strong>{formatMoney(order.subtotalCents)}</strong>
            </div>
            <div className="admin-order-total compact">
              <span>Frete</span>
              <strong>{formatMoney(order.shippingCents)}</strong>
            </div>
            <div className="admin-order-total compact featured">
              <span>Total</span>
              <strong>{formatMoney(order.totalCents)}</strong>
            </div>
          </section>

          <form
            className="admin-panel admin-order-card admin-order-form"
            action={updateOrderAction}
          >
            <div className="admin-panel-header">
              <div>
                <p>Operação</p>
                <h2>Atualizar andamento</h2>
              </div>
            </div>
            <input name="orderId" type="hidden" value={order.id} />
            <input name="orderNumber" type="hidden" value={order.orderNumber} />
            <label>
              Status do pedido
              <select name="status" defaultValue={order.status}>
                <option value="pending">Pendente</option>
                <option value="confirmed">Confirmado</option>
                <option value="processing">Em separação</option>
                <option value="shipped">Enviado</option>
                <option value="delivered">Entregue</option>
                <option value="cancelled">Cancelado</option>
                <option value="refunded">Reembolsado</option>
              </select>
            </label>
            <label>
              Status do pagamento
              <select name="paymentStatus" defaultValue={order.paymentStatus}>
                <option value="unpaid">Não pago</option>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="failed">Falhou</option>
                <option value="refunded">Reembolsado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </label>
            <label>
              Notas internas
              <textarea
                defaultValue={order.adminNotes}
                name="adminNotes"
                rows={5}
              />
            </label>
            <label>
              Código de rastreio
              <input
                defaultValue={order.trackingCode ?? ''}
                name="trackingCode"
                placeholder="Ex.: BR123456789BR"
              />
            </label>
            <label>
              Link da etiqueta ou comprovante de envio
              <input
                defaultValue={order.shippingLabelUrl ?? ''}
                name="shippingLabelUrl"
                placeholder="https://..."
                type="url"
              />
            </label>
            <button className="admin-primary-button" type="submit">
              Salvar pedido
            </button>
          </form>
        </div>

        <section className="admin-panel admin-order-card admin-customer-card">
          <div className="admin-panel-header">
            <div>
              <p>Cliente</p>
              <h2>Cliente e entrega</h2>
            </div>
          </div>
          <div className="admin-info-list">
            <article>
              <span>Cliente</span>
              <strong>{order.customerName}</strong>
              {order.customerEmail ? (
                <small>{order.customerEmail}</small>
              ) : null}
              {order.customerPhone ? (
                <small>{order.customerPhone}</small>
              ) : null}
            </article>
            <article>
              <span>Endereço</span>
              <strong>
                {order.shippingAddress
                  ? formatAddress(order.shippingAddress)
                  : 'Endereço não informado'}
              </strong>
            </article>
            <article>
              <span>Frete escolhido</span>
              <strong>
                {order.shippingQuote
                  ? `${order.shippingQuote.serviceName} · ${formatMoney(
                      order.shippingQuote.priceCents,
                    )}`
                  : 'Frete a confirmar'}
              </strong>
              {order.shippingQuote ? (
                <small>
                  {order.shippingQuote.provider} ·{' '}
                  {formatDeliveryWindow(
                    order.shippingQuote.deliveryMinDays,
                    order.shippingQuote.deliveryMaxDays,
                  )}
                </small>
              ) : null}
            </article>
          </div>
        </section>
      </div>
    </section>
  );
}
