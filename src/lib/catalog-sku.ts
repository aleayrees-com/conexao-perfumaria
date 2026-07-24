import { createCatalogSlug } from './catalog-slug';

/**
 * Creates a recognizable SKU that stays unique without manual catalog work.
 *
 * @example createCatalogSku('Óleo & Âmbar 100ml', 'e93a19cf-842d-4f8e-945d-111111111111')
 */
export function createCatalogSku(name: string, uniqueId: string): string {
  const productCode = createCatalogSlug(name).slice(0, 27).toUpperCase();
  const uniqueCode = uniqueId.replaceAll('-', '').slice(0, 8).toUpperCase();

  return `CX-${productCode}-${uniqueCode}`;
}
