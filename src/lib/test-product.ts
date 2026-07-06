import type { Product } from '@/types/catalog';
import type { ShippingQuote } from '@/lib/shipping';

export const TEST_PRODUCT_SKU = 'TESTE-COMPRA-000';
export const TEST_PRODUCT_SLUG = 'produto-teste-infinitepay';
export const TEST_PRODUCT_ID = 990000001;
export const TEST_PRODUCT_VARIANT_ID = 990000002;

export const TEST_PRODUCT: Product = {
  id: TEST_PRODUCT_ID,
  slug: TEST_PRODUCT_SLUG,
  name: 'Produto Teste InfinitePay',
  description:
    'Produto oculto criado para validar o fluxo real de pagamento pela InfinitePay.',
  sourceUrl: `https://conexaoimportados.com.br/produtos/${TEST_PRODUCT_SLUG}`,
  imageUrls: [],
  category: {
    name: 'Teste',
    slug: 'teste',
    url: '/produtos?busca=TESTE-COMPRA-000',
  },
  variants: [
    {
      id: TEST_PRODUCT_VARIANT_ID,
      sku: TEST_PRODUCT_SKU,
      label: 'Teste de compra',
      priceCents: 100,
      compareAtPriceCents: null,
      pixPriceCents: null,
      stock: 20,
      available: true,
      imageUrl: null,
    },
  ],
  priceCents: 100,
  compareAtPriceCents: null,
  pixPriceCents: null,
  totalStock: 20,
  available: true,
  importedAt: '2026-06-19T00:00:00.000Z',
  catalogVisibility: 'sku_only',
  shippingPackage: {
    weightGrams: 1,
    heightCm: 1,
    widthCm: 1,
    lengthCm: 1,
  },
};

export const TEST_FREE_SHIPPING_QUOTE: ShippingQuote = {
  id: 'test-free-shipping',
  provider: 'manual',
  serviceName: 'Frete teste gratuito',
  priceCents: 0,
  deliveryMinDays: 0,
  deliveryMaxDays: 0,
  raw: {
    mode: 'test-product',
  },
};

export function withSkuOnlyTestProduct(
  products: readonly Product[],
): readonly Product[] {
  if (products.some((product) => product.slug === TEST_PRODUCT_SLUG)) {
    return products;
  }

  return [...products, TEST_PRODUCT];
}

export function isTestProductVariantId(variantId: number): boolean {
  return variantId === TEST_PRODUCT_VARIANT_ID;
}
