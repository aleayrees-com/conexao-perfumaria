export interface AdminSalesOrder {
  readonly createdAt: string;
  readonly paymentStatus: string;
  readonly status: string;
  readonly totalCents: number;
}

export interface AdminSalesSummary {
  readonly averagePaidTicketCents: number;
  readonly currentMonthPaidRevenueCents: number;
  readonly paidOrderCount: number;
  readonly paidRevenueCents: number;
  readonly pendingOrderCount: number;
  readonly totalOrderCount: number;
}

function toBrazilianMonthKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
  }).format(date);
}

function isPaidOrder(order: AdminSalesOrder): boolean {
  return order.paymentStatus === 'paid';
}

export function summarizeAdminSales(
  orders: readonly AdminSalesOrder[],
  referenceDate: Date,
): AdminSalesSummary {
  const paidOrders = orders.filter(isPaidOrder);
  const paidRevenueCents = paidOrders.reduce(
    (total, order) => total + order.totalCents,
    0,
  );
  const currentMonthKey = toBrazilianMonthKey(referenceDate);
  const currentMonthPaidRevenueCents = paidOrders
    .filter(
      (order) =>
        toBrazilianMonthKey(new Date(order.createdAt)) === currentMonthKey,
    )
    .reduce((total, order) => total + order.totalCents, 0);

  return {
    averagePaidTicketCents:
      paidOrders.length === 0
        ? 0
        : Math.round(paidRevenueCents / paidOrders.length),
    currentMonthPaidRevenueCents,
    paidOrderCount: paidOrders.length,
    paidRevenueCents,
    pendingOrderCount: orders.filter((order) => order.status === 'pending')
      .length,
    totalOrderCount: orders.length,
  };
}
