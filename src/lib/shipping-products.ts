import type { Product, ProductVariant } from '@/types/catalog';
import type { ShippingQuoteItem } from '@/lib/shipping';

const DEFAULT_PRODUCT_PACKAGE = {
  weightGrams: 250,
  heightCm: 8,
  widthCm: 8,
  lengthCm: 16,
} as const;

export function productVariantToShippingQuoteItem({
  product,
  quantity,
  variant,
}: {
  readonly product: Product;
  readonly quantity: number;
  readonly variant: ProductVariant;
}): ShippingQuoteItem {
  const shippingPackage = product.shippingPackage ?? DEFAULT_PRODUCT_PACKAGE;

  return {
    id: variant.sku ?? String(variant.id),
    widthCm: shippingPackage.widthCm,
    heightCm: shippingPackage.heightCm,
    lengthCm: shippingPackage.lengthCm,
    weightGrams: shippingPackage.weightGrams,
    insuranceCents: variant.priceCents,
    quantity,
  };
}
