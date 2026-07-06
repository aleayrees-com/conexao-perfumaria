import {
  buildCheckoutCustomerRecord,
  mergeMarketingOptIn,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
} from '@/lib/customer-profile';

describe('customer profile helpers', () => {
  it('normalizes customer identifiers for repeat purchases', () => {
    expect(normalizeCustomerEmail('  MARIA@EXAMPLE.COM  ')).toBe(
      'maria@example.com',
    );
    expect(normalizeCustomerPhone(' +55 (11) 99999-0000 ')).toBe('11999990000');
  });

  it('builds a remarketing-ready customer record from checkout details', () => {
    expect(
      buildCheckoutCustomerRecord({
        address: {
          cep: '01001000',
          city: 'São Paulo',
          complement: null,
          neighborhood: 'Sé',
          number: '100',
          state: 'SP',
          street: 'Praça da Sé',
        },
        customer: {
          email: ' MARIA@EXAMPLE.COM ',
          marketingOptIn: true,
          name: ' Maria Souza ',
          phone: '(11) 99999-0000',
        },
      }),
    ).toEqual({
      default_shipping_address: {
        cep: '01001000',
        city: 'São Paulo',
        complement: null,
        neighborhood: 'Sé',
        number: '100',
        state: 'SP',
        street: 'Praça da Sé',
      },
      email: 'maria@example.com',
      marketing_opt_in: true,
      name: 'Maria Souza',
      phone: '11999990000',
    });
  });

  it('keeps previous marketing consent when a repeat checkout is not opted in', () => {
    expect(mergeMarketingOptIn(true, false)).toBe(true);
    expect(mergeMarketingOptIn(false, true)).toBe(true);
    expect(mergeMarketingOptIn(false, false)).toBe(false);
  });
});
