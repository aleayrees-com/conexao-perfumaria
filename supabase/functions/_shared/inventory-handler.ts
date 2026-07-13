import {
  InventorySheetError,
  parseInventoryCsv,
  type InventoryRow,
} from './inventory-sheet';

export interface CsvFetchResult {
  readonly ok: boolean;
  readonly status: number;
  readonly contentType: string;
  readonly text: string;
}

export interface InventorySyncChange {
  readonly nuvemshopVariantId: number;
  readonly currentStock: number;
  readonly newStock: number;
}

export interface InventorySyncSummary {
  readonly scanned: number;
  readonly changed: number;
  readonly unchanged: number;
  readonly changes: readonly InventorySyncChange[];
}

export interface InventoryRunStore {
  readonly start: (dryRun: boolean) => Promise<string>;
  readonly succeed: (
    runId: string,
    summary: InventorySyncSummary,
  ) => Promise<void>;
  readonly fail: (runId: string, errorSummary: string) => Promise<void>;
}

export interface InventorySyncDependencies {
  readonly sheetCsvUrl: string;
  readonly fetchCsv: (url: string) => Promise<CsvFetchResult>;
  readonly runs: InventoryRunStore;
  readonly syncSnapshot: (
    rows: readonly InventoryRow[],
    dryRun: boolean,
  ) => Promise<InventorySyncSummary>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function parseSyncChange(value: unknown): InventorySyncChange | null {
  if (!isRecord(value)) {
    return null;
  }

  const { nuvemshopVariantId, currentStock, newStock } = value;

  if (
    !Number.isSafeInteger(nuvemshopVariantId) ||
    Number(nuvemshopVariantId) <= 0 ||
    !isNonNegativeInteger(currentStock) ||
    !isNonNegativeInteger(newStock)
  ) {
    return null;
  }

  return {
    nuvemshopVariantId: Number(nuvemshopVariantId),
    currentStock,
    newStock,
  };
}

export function parseInventorySyncSummary(
  value: unknown,
): InventorySyncSummary {
  const invalidResponse = new Error(
    'Resposta inválida da sincronização no Supabase.',
  );

  if (!isRecord(value)) {
    throw invalidResponse;
  }

  const { scanned, changed, unchanged, changes } = value;

  if (
    !isNonNegativeInteger(scanned) ||
    !isNonNegativeInteger(changed) ||
    !isNonNegativeInteger(unchanged) ||
    changed + unchanged !== scanned ||
    !Array.isArray(changes)
  ) {
    throw invalidResponse;
  }

  const parsedChanges = changes.map(parseSyncChange);

  if (
    parsedChanges.some((change) => change === null) ||
    parsedChanges.length !== changed
  ) {
    throw invalidResponse;
  }

  return {
    scanned,
    changed,
    unchanged,
    changes: parsedChanges as InventorySyncChange[],
  };
}

interface InventoryRequestBody {
  readonly dryRun: boolean;
}

class InventoryHandlerError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'InventoryHandlerError';
    this.status = status;
  }
}

async function readRequestBody(
  request: Request,
): Promise<InventoryRequestBody> {
  const text = await request.text();

  if (text.trim().length === 0) {
    return { dryRun: false };
  }

  let value: unknown;

  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new InventoryHandlerError('Corpo JSON inválido.', 400);
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InventoryHandlerError('Corpo JSON inválido.', 400);
  }

  const dryRun = (value as Record<string, unknown>).dryRun;

  if (dryRun !== undefined && typeof dryRun !== 'boolean') {
    throw new InventoryHandlerError('dryRun deve ser booleano.', 400);
  }

  return { dryRun: dryRun ?? false };
}

function sanitizeError(error: unknown): string {
  const rawMessage =
    error instanceof Error
      ? error.message
      : 'Falha desconhecida na sincronização.';
  const message = rawMessage.replace(/\s+/g, ' ').trim().slice(0, 500);

  return message || 'Falha desconhecida na sincronização.';
}

function getErrorStatus(error: unknown): number {
  if (error instanceof InventoryHandlerError) {
    return error.status;
  }

  if (error instanceof InventorySheetError) {
    return 422;
  }

  return 500;
}

async function recordFailure(
  runs: InventoryRunStore,
  runId: string,
  message: string,
): Promise<void> {
  try {
    await runs.fail(runId, message);
  } catch {
    return;
  }
}

function errorResponse(
  error: unknown,
  status: number,
  runId?: string,
): Response {
  return Response.json(
    {
      ok: false,
      ...(runId ? { runId } : {}),
      error: sanitizeError(error),
    },
    { status },
  );
}

export function createInventorySyncHandler(
  dependencies: InventorySyncDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'POST') {
      return Response.json(
        { ok: false, error: 'Método não permitido.' },
        { status: 405, headers: { Allow: 'POST' } },
      );
    }

    let body: InventoryRequestBody;

    try {
      body = await readRequestBody(request);
    } catch (error: unknown) {
      return errorResponse(error, getErrorStatus(error));
    }

    let runId: string;

    try {
      runId = await dependencies.runs.start(body.dryRun);
    } catch (error: unknown) {
      return errorResponse(error, 500);
    }

    try {
      let csvResponse: CsvFetchResult;

      try {
        csvResponse = await dependencies.fetchCsv(dependencies.sheetCsvUrl);
      } catch {
        throw new InventoryHandlerError(
          'Falha de rede ao baixar a planilha de estoque.',
          502,
        );
      }

      if (!csvResponse.ok) {
        throw new InventoryHandlerError(
          `Falha ao baixar a planilha de estoque (HTTP ${csvResponse.status}).`,
          502,
        );
      }

      if (!csvResponse.contentType.toLowerCase().includes('text/csv')) {
        throw new InventoryHandlerError(
          'A planilha não retornou conteúdo CSV.',
          502,
        );
      }

      const snapshot = parseInventoryCsv(csvResponse.text);
      const summary = await dependencies.syncSnapshot(
        snapshot.rows,
        body.dryRun,
      );

      await dependencies.runs.succeed(runId, summary);

      return Response.json({
        ok: true,
        dryRun: body.dryRun,
        runId,
        ...summary,
      });
    } catch (error: unknown) {
      const message = sanitizeError(error);
      await recordFailure(dependencies.runs, runId, message);

      return errorResponse(error, getErrorStatus(error), runId);
    }
  };
}
