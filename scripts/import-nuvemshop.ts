import { mkdir, writeFile } from 'node:fs/promises';

import type {
  Product,
  ProductCategory,
  ProductVariant,
} from '../src/types/catalog.js';

const STORE_URL = 'https://conexaoperfumaria.com.br';
const SITEMAP_URL = `${STORE_URL}/sitemap.xml`;
const OUTPUT_FILE = new URL('../src/data/products.json', import.meta.url);
const CONCURRENCY = 6;

type JsonRecord = Record<string, unknown>;

interface SitemapEntry {
  readonly loc: string;
  readonly images: readonly string[];
}

interface ParsedPage {
  readonly product: Product | null;
  readonly error: string | null;
}

interface RawVariantShape {
  readonly productId: number | null;
  readonly variant: ProductVariant | null;
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(record: JsonRecord, key: string): string | null {
  const value = record[key];

  return typeof value === 'string' ? value : null;
}

function getNumber(record: JsonRecord, key: string): number | null {
  const value = record[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function decodeXml(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(input: string): string {
  return decodeXml(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function normalizeUrl(input: string): string {
  if (input.startsWith('//')) {
    return `https:${input}`;
  }

  if (input.startsWith('/')) {
    return `${STORE_URL}${input}`;
  }

  return input;
}

function slugFromUrl(input: string): string {
  const parsed = new URL(input);
  const parts = parsed.pathname.split('/').filter(Boolean);

  return parts.at(-1) ?? '';
}

function centsFromNumber(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 100);
}

function centsFromBrazilianMoney(input: string | null): number | null {
  if (!input) {
    return null;
  }

  const normalized = input
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const value = Number.parseFloat(normalized);

  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

function hashSlug(slug: string): number {
  let hash = 0;

  for (const char of slug) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function parseSitemap(xml: string): readonly SitemapEntry[] {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .map((match) => {
      const block = match[1] ?? '';
      const locMatch = block.match(/<loc>([\s\S]*?)<\/loc>/);
      const loc = locMatch?.[1] ? decodeXml(locMatch[1].trim()) : '';
      const images = [...block.matchAll(/<image:loc>([\s\S]*?)<\/image:loc>/g)]
        .map((imageMatch) => imageMatch[1])
        .filter((image): image is string => Boolean(image))
        .map((image) => normalizeUrl(decodeXml(image.trim())));

      return { loc, images };
    })
    .filter((entry) => {
      return (
        entry.loc.startsWith(`${STORE_URL}/produtos/`) &&
        entry.loc !== `${STORE_URL}/produtos/`
      );
    });
}

function parseJsonLdBlocks(html: string): readonly JsonRecord[] {
  return [
    ...html.matchAll(
      /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].flatMap((match) => {
    const json = match[1]?.trim();

    if (!json) {
      return [];
    }

    try {
      const parsed = JSON.parse(json) as unknown;
      const values = Array.isArray(parsed) ? parsed : [parsed];

      return values
        .map((value) => asRecord(value))
        .filter((record): record is JsonRecord => Boolean(record));
    } catch {
      return [];
    }
  });
}

function getTypeName(record: JsonRecord): string {
  const type = record['@type'];

  if (typeof type === 'string') {
    return type;
  }

  if (Array.isArray(type)) {
    return type
      .filter((item): item is string => typeof item === 'string')
      .join(' ');
  }

  return '';
}

function findWebPage(records: readonly JsonRecord[]): JsonRecord | null {
  return (
    records.find((record) => getTypeName(record).includes('WebPage')) ?? null
  );
}

function getProductUrl(record: JsonRecord): string | null {
  const offers = asRecord(record.offers);
  const mainEntityOfPage = asRecord(record.mainEntityOfPage);

  return (
    getString(record, '@id') ??
    getString(offers ?? {}, 'url') ??
    getString(mainEntityOfPage ?? {}, '@id')
  );
}

function findProductRecord(
  records: readonly JsonRecord[],
  sourceUrl: string,
): JsonRecord | null {
  const webPage = findWebPage(records);
  const mainEntity = webPage ? asRecord(webPage.mainEntity) : null;

  if (mainEntity && getTypeName(mainEntity).includes('Product')) {
    return mainEntity;
  }

  return (
    records.find((record) => {
      return (
        getTypeName(record).includes('Product') &&
        getProductUrl(record) === sourceUrl
      );
    }) ??
    records.find((record) => getTypeName(record).includes('Product')) ??
    null
  );
}

function extractCategory(
  records: readonly JsonRecord[],
): ProductCategory | null {
  const webPage = findWebPage(records);
  const breadcrumb = webPage ? asRecord(webPage.breadcrumb) : null;
  const elements = breadcrumb ? asArray(breadcrumb.itemListElement) : [];
  const recordsOnly = elements
    .map((element) => asRecord(element))
    .filter((element): element is JsonRecord => Boolean(element));

  if (recordsOnly.length < 3) {
    return null;
  }

  const category = recordsOnly.at(-2);

  if (!category) {
    return null;
  }

  const name = getString(category, 'name');
  const url = getString(category, 'item');

  if (!name || !url) {
    return null;
  }

  return {
    name,
    slug: slugFromUrl(url),
    url,
  };
}

function parseRawVariants(html: string): readonly JsonRecord[] {
  const start = html.indexOf('LS.variants = ');

  if (start < 0) {
    return [];
  }

  const arrayStart = html.indexOf('[', start);
  const arrayEnd = html.indexOf('];', arrayStart);

  if (arrayStart < 0 || arrayEnd < 0) {
    return [];
  }

  const json = html.slice(arrayStart, arrayEnd + 1);

  try {
    const parsed = JSON.parse(json) as unknown;

    return asArray(parsed)
      .map((value) => asRecord(value))
      .filter((record): record is JsonRecord => Boolean(record));
  } catch {
    return [];
  }
}

function getVariantLabel(record: JsonRecord, index: number): string {
  const options = ['option0', 'option1', 'option2']
    .map((key) => getString(record, key))
    .filter((value): value is string => Boolean(value));

  if (options.length > 0) {
    return options.join(' / ');
  }

  return index === 0 ? 'Unico' : `Opcao ${index + 1}`;
}

function parseVariant(record: JsonRecord, index: number): RawVariantShape {
  const priceCents =
    getNumber(record, 'price_number_raw') ??
    centsFromNumber(getNumber(record, 'price_number'));

  if (priceCents === null) {
    return {
      productId: getNumber(record, 'product_id'),
      variant: null,
    };
  }

  const stock = Math.max(0, Math.round(getNumber(record, 'stock') ?? 0));
  const available = record.available === true && stock > 0;
  const compareAtPriceCents = getNumber(record, 'compare_at_price_number_raw');
  const pixPriceCents = centsFromBrazilianMoney(
    getString(record, 'price_with_payment_discount_short'),
  );
  const imageUrl = getString(record, 'image_url');
  const sku = getString(record, 'sku');

  return {
    productId: getNumber(record, 'product_id'),
    variant: {
      id: Math.round(getNumber(record, 'id') ?? index),
      sku,
      label: getVariantLabel(record, index),
      priceCents: Math.round(priceCents),
      compareAtPriceCents: compareAtPriceCents
        ? Math.round(compareAtPriceCents)
        : null,
      pixPriceCents,
      stock,
      available,
      imageUrl: imageUrl ? normalizeUrl(imageUrl) : null,
    },
  };
}

function getOfferRecord(productRecord: JsonRecord): JsonRecord | null {
  const offers = productRecord.offers;

  if (Array.isArray(offers)) {
    return offers.map((offer) => asRecord(offer)).find(Boolean) ?? null;
  }

  return asRecord(offers);
}

function getInventoryFromOffer(offer: JsonRecord | null): number {
  const inventoryLevel = offer ? asRecord(offer.inventoryLevel) : null;
  const value = inventoryLevel ? getNumber(inventoryLevel, 'value') : null;

  return Math.max(0, Math.round(value ?? 0));
}

function buildFallbackVariant(
  productRecord: JsonRecord,
  sourceUrl: string,
): ProductVariant | null {
  const offer = getOfferRecord(productRecord);
  const priceCents = offer ? centsFromNumber(getNumber(offer, 'price')) : null;

  if (priceCents === null) {
    return null;
  }

  const stock = getInventoryFromOffer(offer);
  const availability = offer ? getString(offer, 'availability') : null;

  return {
    id: hashSlug(sourceUrl),
    sku: getString(productRecord, 'sku'),
    label: 'Unico',
    priceCents,
    compareAtPriceCents: null,
    pixPriceCents: null,
    stock,
    available: Boolean(availability?.includes('InStock')) && stock > 0,
    imageUrl: getString(productRecord, 'image'),
  };
}

function compactDescription(description: string): string {
  const clean = stripHtml(description);

  if (!clean) {
    return 'Produto selecionado pela curadoria Conexao Perfumaria.';
  }

  return clean;
}

function uniqueImages(
  sitemapImages: readonly string[],
  productRecord: JsonRecord,
  variants: readonly ProductVariant[],
): readonly string[] {
  const images = new Set<string>();
  const productImage = getString(productRecord, 'image');

  for (const image of sitemapImages) {
    images.add(normalizeUrl(image));
  }

  if (productImage) {
    images.add(normalizeUrl(productImage));
  }

  for (const variant of variants) {
    if (variant.imageUrl) {
      images.add(normalizeUrl(variant.imageUrl));
    }
  }

  return [...images];
}

function parseProductPage(entry: SitemapEntry, html: string): ParsedPage {
  const records = parseJsonLdBlocks(html);
  const productRecord = findProductRecord(records, entry.loc);

  if (!productRecord) {
    return {
      product: null,
      error: 'JSON-LD de produto nao encontrado.',
    };
  }

  const rawVariantShapes = parseRawVariants(html).map((variant, index) =>
    parseVariant(variant, index),
  );
  const parsedVariants = rawVariantShapes
    .map((shape) => shape.variant)
    .filter((variant): variant is ProductVariant => Boolean(variant));
  const fallbackVariant = buildFallbackVariant(productRecord, entry.loc);
  const variants =
    parsedVariants.length > 0
      ? parsedVariants
      : fallbackVariant
        ? [fallbackVariant]
        : [];

  if (variants.length === 0) {
    return {
      product: null,
      error: 'Preco/variacao nao encontrados.',
    };
  }

  const name = getString(productRecord, 'name');

  if (!name) {
    return {
      product: null,
      error: 'Nome nao encontrado.',
    };
  }

  const slug = slugFromUrl(entry.loc);
  const priceCents = Math.min(...variants.map((variant) => variant.priceCents));
  const compareAtCandidates = variants
    .map((variant) => variant.compareAtPriceCents)
    .filter((value): value is number => value !== null);
  const pixCandidates = variants
    .map((variant) => variant.pixPriceCents)
    .filter((value): value is number => value !== null);
  const totalStock = variants.reduce(
    (total, variant) => total + variant.stock,
    0,
  );
  const productId =
    rawVariantShapes.find((shape) => shape.productId !== null)?.productId ??
    hashSlug(slug);

  return {
    product: {
      id: productId,
      slug,
      name,
      description: compactDescription(
        getString(productRecord, 'description') ?? '',
      ),
      sourceUrl: entry.loc,
      imageUrls: uniqueImages(entry.images, productRecord, variants),
      category: extractCategory(records),
      variants,
      priceCents,
      compareAtPriceCents:
        compareAtCandidates.length > 0
          ? Math.min(...compareAtCandidates)
          : null,
      pixPriceCents:
        pixCandidates.length > 0 ? Math.min(...pixCandidates) : null,
      totalStock,
      available: variants.some((variant) => variant.available),
      importedAt: new Date().toISOString(),
    },
    error: null,
  };
}

async function fetchText(url: string, attempt = 1): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (compatible; ConexaoPerfumariaImporter/1.0; +https://conexaoperfumaria.com.br)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));

      return fetchText(url, attempt + 1);
    }

    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<readonly R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index] as T, index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

async function importProducts(): Promise<void> {
  console.log('Baixando sitemap publico da Nuvemshop...');
  const sitemap = await fetchText(SITEMAP_URL);
  const fallbackHomeHtml = await fetchText(STORE_URL);
  const entries = parseSitemap(sitemap);
  console.log(`Encontrados ${entries.length} produtos no sitemap.`);

  const pages = await mapWithConcurrency(
    entries,
    CONCURRENCY,
    async (entry, index) => {
      try {
        const html = await fetchText(entry.loc);
        const parsed = parseProductPage(entry, html);
        const position = `${index + 1}/${entries.length}`;

        if (parsed.product) {
          console.log(`[${position}] OK ${parsed.product.name}`);

          return parsed;
        }

        const fallbackParsed = parseProductPage(entry, fallbackHomeHtml);

        if (fallbackParsed.product) {
          console.log(
            `[${position}] OK fallback ${fallbackParsed.product.name}`,
          );

          return fallbackParsed;
        } else {
          console.warn(`[${position}] Falha ${entry.loc}: ${parsed.error}`);
        }

        return parsed;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Erro desconhecido';
        const fallbackParsed = parseProductPage(entry, fallbackHomeHtml);

        if (fallbackParsed.product) {
          console.log(
            `[${index + 1}/${entries.length}] OK fallback ${fallbackParsed.product.name}`,
          );

          return fallbackParsed;
        }

        console.warn(
          `[${index + 1}/${entries.length}] Falha ${entry.loc}: ${message}`,
        );

        return {
          product: null,
          error: message,
        };
      }
    },
  );

  const products = pages
    .map((page) => page.product)
    .filter((product): product is Product => Boolean(product))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  const failures = pages.filter((page) => page.product === null).length;

  await mkdir(new URL('../src/data', import.meta.url), { recursive: true });
  await writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(products, null, 2)}\n`,
    'utf8',
  );

  console.log(`Importacao finalizada: ${products.length} produtos salvos.`);

  if (failures > 0) {
    console.warn(`${failures} produtos falharam e precisam de revisao manual.`);
  }
}

await importProducts();
