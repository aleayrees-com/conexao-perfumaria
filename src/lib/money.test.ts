import {
  formatMoney,
  getInstallmentText,
  parseBrazilianMoney,
} from '@/lib/money';

describe('money helpers', () => {
  it('formats cents as BRL', () => {
    expect(formatMoney(11578)).toBe('R$ 115,78');
  });

  it('parses Brazilian money strings', () => {
    expect(parseBrazilianMoney('R$1.149,99')).toBe(114999);
  });

  it('builds installment copy', () => {
    expect(getInstallmentText(12000, 3)).toBe('3x de R$ 40,00 sem juros');
  });
});
