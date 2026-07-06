export type ProductStatus = 'draft' | 'active' | 'archived';

export type BulkMoneyMode =
  | 'set'
  | 'increase_percent'
  | 'decrease_percent'
  | 'increase_amount'
  | 'decrease_amount'
  | 'clear';

export interface BulkMoneyOperation {
  readonly mode: BulkMoneyMode;
  readonly value: number | null;
}

export interface BulkProductCsvRow {
  readonly productId: string;
  readonly slug: string;
  readonly name: string;
  readonly status: string;
  readonly categoryId: string;
  readonly price: string;
  readonly pixPrice: string;
  readonly compareAtPrice: string;
  readonly variantId: string;
  readonly variantLabel: string;
  readonly variantSku: string;
  readonly variantPrice: string;
  readonly variantPixPrice: string;
  readonly variantCompareAtPrice: string;
  readonly variantStock: string;
  readonly variantAvailable: string;
}

export interface BulkProductCsvExportRow {
  readonly productId: string;
  readonly slug: string;
  readonly name: string;
  readonly status: ProductStatus;
  readonly categoryId: string | null;
  readonly priceCents: number;
  readonly pixPriceCents: number | null;
  readonly compareAtPriceCents: number | null;
  readonly variantId: string;
  readonly variantLabel: string;
  readonly variantSku: string | null;
  readonly variantPriceCents: number;
  readonly variantPixPriceCents: number | null;
  readonly variantCompareAtPriceCents: number | null;
  readonly variantStock: number;
  readonly variantAvailable: boolean;
}

export interface ParsedBulkProductCsv {
  readonly rows: readonly BulkProductCsvRow[];
  readonly errors: readonly string[];
}

const CSV_HEADERS = [
  'product_id',
  'slug',
  'name',
  'status',
  'category_id',
  'price',
  'pix_price',
  'compare_at_price',
  'variant_id',
  'variant_label',
  'variant_sku',
  'variant_price',
  'variant_pix_price',
  'variant_compare_at_price',
  'variant_stock',
  'variant_available',
] as const;

function clampMoney(value: number): number {
  return Math.max(0, Math.round(value));
}

export function applyMoneyOperation(
  currentCents: number | null,
  operation: BulkMoneyOperation,
): number | null {
  const current = currentCents ?? 0;
  const value = operation.value ?? 0;

  if (operation.mode === 'clear') {
    return null;
  }

  if (operation.mode === 'set') {
    return clampMoney(value);
  }

  if (operation.mode === 'increase_percent') {
    return clampMoney(current * (1 + value / 100));
  }

  if (operation.mode === 'decrease_percent') {
    return clampMoney(current * (1 - value / 100));
  }

  if (operation.mode === 'increase_amount') {
    return clampMoney(current + value);
  }

  return clampMoney(current - value);
}

function formatMoney(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2);
}

function escapeCsvCell(value: string | number | boolean | null): string {
  const text = value === null ? '' : String(value);

  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function splitCsvLine(line: string): readonly string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);

  return cells;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

export function buildBulkProductsCsv(
  rows: readonly BulkProductCsvExportRow[],
): string {
  const csvRows = rows.map((row) =>
    [
      row.productId,
      row.slug,
      row.name,
      row.status,
      row.categoryId,
      formatMoney(row.priceCents),
      formatMoney(row.pixPriceCents),
      formatMoney(row.compareAtPriceCents),
      row.variantId,
      row.variantLabel,
      row.variantSku,
      formatMoney(row.variantPriceCents),
      formatMoney(row.variantPixPriceCents),
      formatMoney(row.variantCompareAtPriceCents),
      row.variantStock,
      row.variantAvailable ? 'sim' : 'não',
    ]
      .map(escapeCsvCell)
      .join(','),
  );

  return [CSV_HEADERS.join(','), ...csvRows].join('\n');
}

export function parseBulkProductsCsv(csv: string): ParsedBulkProductCsv {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { rows: [], errors: ['Arquivo CSV vazio.'] };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const errors: string[] = [];

  for (const header of CSV_HEADERS) {
    if (!headers.includes(header)) {
      errors.push(`Cabecalho ausente: ${header}.`);
    }
  }

  if (errors.length > 0) {
    return { rows: [], errors };
  }

  const headerIndex = new Map(
    headers.map((header, index) => [header, index] as const),
  );
  const readCell = (cells: readonly string[], header: string): string =>
    cells[headerIndex.get(header) ?? -1]?.trim() ?? '';

  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);

    return {
      productId: readCell(cells, 'product_id'),
      slug: readCell(cells, 'slug'),
      name: readCell(cells, 'name'),
      status: readCell(cells, 'status'),
      categoryId: readCell(cells, 'category_id'),
      price: readCell(cells, 'price'),
      pixPrice: readCell(cells, 'pix_price'),
      compareAtPrice: readCell(cells, 'compare_at_price'),
      variantId: readCell(cells, 'variant_id'),
      variantLabel: readCell(cells, 'variant_label'),
      variantSku: readCell(cells, 'variant_sku'),
      variantPrice: readCell(cells, 'variant_price'),
      variantPixPrice: readCell(cells, 'variant_pix_price'),
      variantCompareAtPrice: readCell(cells, 'variant_compare_at_price'),
      variantStock: readCell(cells, 'variant_stock'),
      variantAvailable: readCell(cells, 'variant_available'),
    };
  });

  return { rows, errors };
}
