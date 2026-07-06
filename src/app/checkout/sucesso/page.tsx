import Link from 'next/link';

import { CheckoutSuccessTracker } from '@/components/checkout-success-tracker';
import { getOrderPurchaseTrackingPayload } from '@/lib/order-payments';

interface CheckoutSuccessPageProps {
  readonly searchParams?: Promise<{
    readonly pedido?: string;
    readonly status?: string;
    readonly metodo?: string;
    readonly comprovante?: string;
  }>;
}

export const metadata = {
  title: 'Pedido recebido',
  description: 'Status do pagamento do pedido na Conexão Perfumaria.',
};

export const dynamic = 'force-dynamic';

function getStatusCopy(status: string | undefined): {
  readonly title: string;
  readonly description: string;
} {
  if (status === 'pago') {
    return {
      title: 'Pagamento aprovado',
      description:
        'Recebemos a confirmação do pagamento. A equipe vai separar seu pedido e seguir com o atendimento.',
    };
  }

  if (status === 'pendente') {
    return {
      title: 'Pagamento em confirmação',
      description:
        'Seu pedido foi criado e a confirmação do pagamento pode levar alguns instantes. Se já pagou, pode acompanhar pelo comprovante.',
    };
  }

  return {
    title: 'Pedido recebido',
    description:
      'Seu pedido foi registrado. Se precisar, fale com a equipe pelo WhatsApp para confirmar os próximos passos.',
  };
}

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  const resolvedSearchParams = await searchParams;
  const orderNumber = resolvedSearchParams?.pedido?.trim() || null;
  const receiptUrl = resolvedSearchParams?.comprovante?.trim() || null;
  const captureMethod = resolvedSearchParams?.metodo?.trim() || null;
  const statusCopy = getStatusCopy(resolvedSearchParams?.status);
  const tracking = orderNumber
    ? await getOrderPurchaseTrackingPayload(orderNumber)
    : null;

  return (
    <section className="checkout-shell">
      <CheckoutSuccessTracker tracking={tracking} />
      <div className="checkout-card">
        <div>
          <p className="eyebrow">Checkout InfinitePay</p>
          <h1>{statusCopy.title}</h1>
          <p>{statusCopy.description}</p>
        </div>

        <div className="checkout-total">
          <span>Pedido</span>
          <strong>{orderNumber ?? 'Em análise'}</strong>
        </div>

        {captureMethod ? (
          <p className="checkout-payment-note">
            Forma de pagamento: {captureMethod}
          </p>
        ) : null}

        <div className="checkout-actions">
          {receiptUrl ? (
            <a
              className="button"
              href={receiptUrl}
              rel="noreferrer"
              target="_blank"
            >
              Ver comprovante
            </a>
          ) : null}
          <Link className="button ghost" href="/produtos">
            Continuar comprando
          </Link>
        </div>
      </div>
    </section>
  );
}
