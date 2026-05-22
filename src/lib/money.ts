const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatMoney(valueCents: number): string {
  return currencyFormatter.format(valueCents / 100);
}

export function parseBrazilianMoney(input: string): number | null {
  const normalized = input
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const value = Number.parseFloat(normalized);

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 100);
}

export function getInstallmentText(
  valueCents: number,
  installments = 3,
): string {
  if (installments <= 0) {
    return formatMoney(valueCents);
  }

  return `${installments}x de ${formatMoney(Math.round(valueCents / installments))} sem juros`;
}
