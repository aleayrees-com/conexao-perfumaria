import { NextResponse } from 'next/server';

import { checkInfinitePayPayment } from '@/lib/infinitepay';
import { markInfinitePayOrderPaid } from '@/lib/order-payments';

export const dynamic = 'force-dynamic';

function readParam(url: URL, key: string): string | null {
  const value = url.searchParams.get(key);

  return value?.trim() || null;
}

function appendIfPresent(
  params: URLSearchParams,
  key: string,
  value: string | null,
) {
  if (value) {
    params.set(key, value);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderNsu = readParam(url, 'order_nsu');
  const transactionNsu = readParam(url, 'transaction_nsu');
  const slug = readParam(url, 'slug');
  const receiptUrl = readParam(url, 'receipt_url');
  const captureMethod = readParam(url, 'capture_method');
  const redirectParams = new URLSearchParams();

  appendIfPresent(redirectParams, 'pedido', orderNsu);
  appendIfPresent(redirectParams, 'metodo', captureMethod);
  appendIfPresent(redirectParams, 'comprovante', receiptUrl);

  if (!orderNsu || !transactionNsu || !slug) {
    redirectParams.set('status', orderNsu ? 'pendente' : 'erro');

    return NextResponse.redirect(
      new URL(`/obrigado?${redirectParams.toString()}`, request.url),
    );
  }

  try {
    const payment = await checkInfinitePayPayment({
      orderNsu,
      transactionNsu,
      slug,
    });

    if (payment.success && payment.paid) {
      const result = await markInfinitePayOrderPaid({
        orderNumber: orderNsu,
        eventSourceUrl: request.url,
        payment: {
          invoiceSlug: slug,
          amountCents: payment.amount,
          paidAmountCents: payment.paidAmount,
          installments: payment.installments,
          captureMethod: payment.captureMethod ?? captureMethod,
          transactionNsu,
          receiptUrl,
          rawPayload:
            typeof payment.responseBody === 'object' &&
            payment.responseBody !== null
              ? (payment.responseBody as Record<string, unknown>)
              : { response: payment.responseBody },
        },
      });

      redirectParams.set('status', result.status === 'paid' ? 'pago' : 'erro');
    } else {
      redirectParams.set('status', 'pendente');
    }
  } catch {
    redirectParams.set('status', 'pendente');
  }

  return NextResponse.redirect(
    new URL(`/obrigado?${redirectParams.toString()}`, request.url),
  );
}
