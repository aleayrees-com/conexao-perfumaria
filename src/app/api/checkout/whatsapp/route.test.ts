import type { Product } from '@/types/catalog';

const getSupabaseProductsStrict = vi.fn<() => Promise<readonly Product[]>>();

vi.mock('@/lib/catalog', () => ({
  getSupabaseProductsStrict,
}));

vi.mock('@/lib/env', () => ({
  publicEnv: {
    whatsappNumber: '5521999999999',
  },
}));

const availableProduct: Product = {
  id: 1,
  slug: 'sabah',
  name: 'Sabah Al Ward',
  description: 'Perfume arabe',
  sourceUrl: 'https://example.com/sabah',
  imageUrls: [],
  category: null,
  variants: [
    {
      id: 123,
      sku: null,
      label: '100ml',
      priceCents: 41000,
      compareAtPriceCents: null,
      pixPriceCents: null,
      stock: 2,
      available: true,
      imageUrl: null,
    },
  ],
  priceCents: 41000,
  compareAtPriceCents: null,
  pixPriceCents: null,
  totalStock: 2,
  available: true,
  importedAt: '2026-05-21T20:37:28.955Z',
};

async function postCheckout(items: readonly unknown[]): Promise<Response> {
  const { POST } = await import('./route');

  return POST(
    new Request('https://conexao.test/api/checkout/whatsapp', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
  );
}

describe('whatsapp checkout route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects variants that are not available anymore', async () => {
    getSupabaseProductsStrict.mockResolvedValue([
      {
        ...availableProduct,
        variants: [
          {
            ...availableProduct.variants[0],
            available: false,
          },
        ],
      },
    ]);

    const response = await postCheckout([{ variantId: 123, quantity: 1 }]);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Um ou mais itens nao estao disponiveis.',
    });
  });

  it('rejects quantities above the current stock', async () => {
    getSupabaseProductsStrict.mockResolvedValue([availableProduct]);

    const response = await postCheckout([{ variantId: 123, quantity: 3 }]);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Quantidade maior que o estoque disponivel.',
    });
  });
});
