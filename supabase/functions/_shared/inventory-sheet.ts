export interface InventoryRow {
  readonly nuvemshopVariantId: number;
  readonly stock: number;
  readonly sourceRow: number;
}

export interface InventorySnapshot {
  readonly rows: readonly InventoryRow[];
  readonly scannedRows: number;
}

export class InventorySheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventorySheetError';
  }
}

interface InventoryHeaders {
  readonly stock: number;
  readonly variantId: number;
}

function parseCsvRecords(csv: string): readonly (readonly string[])[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (inQuotes) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }

  if (inQuotes) {
    throw new InventorySheetError(
      'CSV contém campo entre aspas não finalizado.',
    );
  }

  record.push(field);
  records.push(record);

  return records;
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function findRequiredHeader(
  headers: readonly string[],
  normalizedName: string,
  displayName: string,
): number {
  const matches = headers.flatMap((header, index) =>
    normalizeHeader(header) === normalizedName ? [index] : [],
  );

  if (matches.length === 0) {
    throw new InventorySheetError(
      `Cabeçalho obrigatório ausente: ${displayName}.`,
    );
  }

  if (matches.length > 1) {
    throw new InventorySheetError(`Cabeçalho duplicado: ${displayName}.`);
  }

  return matches[0];
}

function resolveHeaders(headers: readonly string[]): InventoryHeaders {
  return {
    variantId: findRequiredHeader(headers, 'id variacao', 'ID Variação'),
    stock: findRequiredHeader(headers, 'unidades na loja', 'Unidades na loja'),
  };
}

function parseInteger(
  value: string | undefined,
  displayName: string,
  sourceRow: number,
  minimum: number,
): number {
  const normalized = value?.trim() ?? '';

  if (!/^\d+$/.test(normalized)) {
    throw new InventorySheetError(
      `${displayName} inválido na linha ${sourceRow}.`,
    );
  }

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new InventorySheetError(
      `${displayName} inválido na linha ${sourceRow}.`,
    );
  }

  return parsed;
}

export function parseInventoryCsv(csv: string): InventorySnapshot {
  if (csv.trim().length === 0) {
    throw new InventorySheetError('CSV de estoque vazio.');
  }

  const records = parseCsvRecords(csv);
  const headerRow = records[0];

  if (!headerRow) {
    throw new InventorySheetError('CSV de estoque vazio.');
  }

  const headers = resolveHeaders(headerRow);
  const seenVariantIds = new Set<number>();
  const rows: InventoryRow[] = [];

  for (const [index, record] of records.slice(1).entries()) {
    if (record.every((value) => value.trim().length === 0)) {
      continue;
    }

    const sourceRow = index + 2;
    const nuvemshopVariantId = parseInteger(
      record[headers.variantId],
      'ID Variação',
      sourceRow,
      1,
    );
    const stock = parseInteger(
      record[headers.stock],
      'Unidades na loja',
      sourceRow,
      0,
    );

    if (seenVariantIds.has(nuvemshopVariantId)) {
      throw new InventorySheetError(
        `ID Variação duplicado na linha ${sourceRow}: ${nuvemshopVariantId}.`,
      );
    }

    seenVariantIds.add(nuvemshopVariantId);
    rows.push({ nuvemshopVariantId, stock, sourceRow });
  }

  return { rows, scannedRows: rows.length };
}
