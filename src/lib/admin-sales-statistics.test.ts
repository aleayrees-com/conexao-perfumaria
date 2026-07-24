import { describe, expect, test } from 'vitest';

import { summarizeAdminSales } from './admin-sales-statistics';

describe('summarizeAdminSales', () => {
  test('summarizes paid revenue, pending orders, and the current month', () => {
    const summary = summarizeAdminSales(
      [
        {
          createdAt: '2026-07-12T12:00:00.000Z',
          paymentStatus: 'paid',
          status: 'confirmed',
          totalCents: 10000,
        },
        {
          createdAt: '2026-07-20T12:00:00.000Z',
          paymentStatus: 'pending',
          status: 'pending',
          totalCents: 5000,
        },
        {
          createdAt: '2026-06-30T12:00:00.000Z',
          paymentStatus: 'paid',
          status: 'delivered',
          totalCents: 20000,
        },
      ],
      new Date('2026-07-23T12:00:00.000Z'),
    );

    expect(summary).toEqual({
      averagePaidTicketCents: 15000,
      currentMonthPaidRevenueCents: 10000,
      paidOrderCount: 2,
      paidRevenueCents: 30000,
      pendingOrderCount: 1,
      totalOrderCount: 3,
    });
  });
});
