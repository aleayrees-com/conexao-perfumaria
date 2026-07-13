import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createInventorySyncHandler,
  parseInventorySyncSummary,
  type InventoryRunStore,
  type InventorySyncDependencies,
  type InventorySyncSummary,
} from '../../supabase/functions/_shared/inventory-handler';

const summary: InventorySyncSummary = {
  scanned: 1,
  changed: 1,
  unchanged: 0,
  changes: [
    {
      nuvemshopVariantId: 123,
      currentStock: 2,
      newStock: 4,
    },
  ],
};

function createRunStore(): InventoryRunStore & {
  readonly fail: ReturnType<typeof vi.fn>;
  readonly start: ReturnType<typeof vi.fn>;
  readonly succeed: ReturnType<typeof vi.fn>;
} {
  return {
    start: vi.fn().mockResolvedValue('run-1'),
    succeed: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  };
}

function createDependencies(
  overrides: Partial<InventorySyncDependencies> = {},
): InventorySyncDependencies & {
  readonly runs: ReturnType<typeof createRunStore>;
} {
  return {
    sheetCsvUrl: 'https://example.test/inventory.csv',
    fetchCsv: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      contentType: 'text/csv; charset=utf-8',
      text: 'ID Variação,Unidades na loja\n123,4',
    }),
    runs: createRunStore(),
    syncSnapshot: vi.fn().mockResolvedValue(summary),
    ...overrides,
  } as InventorySyncDependencies & {
    readonly runs: ReturnType<typeof createRunStore>;
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('createInventorySyncHandler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts POST dry-run, parses the sheet, calls the RPC once, and logs success', async () => {
    const dependencies = createDependencies();
    const handler = createInventorySyncHandler(dependencies);

    const response = await handler(
      new Request('https://example.test', {
        method: 'POST',
        body: JSON.stringify({ dryRun: true }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      ok: true,
      dryRun: true,
      runId: 'run-1',
      ...summary,
    });
    expect(dependencies.runs.start).toHaveBeenCalledWith(true);
    expect(dependencies.syncSnapshot).toHaveBeenCalledOnce();
    expect(dependencies.syncSnapshot).toHaveBeenCalledWith(
      [{ nuvemshopVariantId: 123, stock: 4, sourceRow: 2 }],
      true,
    );
    expect(dependencies.runs.succeed).toHaveBeenCalledWith('run-1', summary);
    expect(dependencies.runs.fail).not.toHaveBeenCalled();
  });

  it('defaults a blank POST body to a live run', async () => {
    const dependencies = createDependencies();
    const handler = createInventorySyncHandler(dependencies);

    const response = await handler(
      new Request('https://example.test', { method: 'POST' }),
    );

    expect(response.status).toBe(200);
    expect(dependencies.runs.start).toHaveBeenCalledWith(false);
    expect(dependencies.syncSnapshot).toHaveBeenCalledWith(
      expect.any(Array),
      false,
    );
  });

  it('rejects methods other than POST without creating a run', async () => {
    const dependencies = createDependencies();
    const handler = createInventorySyncHandler(dependencies);

    const response = await handler(new Request('https://example.test'));

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(await readJson(response)).toEqual({
      ok: false,
      error: 'Método não permitido.',
    });
    expect(dependencies.runs.start).not.toHaveBeenCalled();
  });

  it.each([
    {
      body: '{',
      message: 'Corpo JSON inválido.',
    },
    {
      body: JSON.stringify({ dryRun: 'yes' }),
      message: 'dryRun deve ser booleano.',
    },
    {
      body: JSON.stringify([]),
      message: 'Corpo JSON inválido.',
    },
  ])(
    'rejects an invalid request body before creating a run',
    async ({ body, message }) => {
      const dependencies = createDependencies();
      const handler = createInventorySyncHandler(dependencies);

      const response = await handler(
        new Request('https://example.test', { method: 'POST', body }),
      );

      expect(response.status).toBe(400);
      expect(await readJson(response)).toEqual({ ok: false, error: message });
      expect(dependencies.runs.start).not.toHaveBeenCalled();
    },
  );

  it('returns 502 and logs failure when the sheet download fails', async () => {
    const dependencies = createDependencies({
      fetchCsv: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        contentType: 'text/html',
        text: 'unavailable',
      }),
    });
    const handler = createInventorySyncHandler(dependencies);

    const response = await handler(
      new Request('https://example.test', { method: 'POST' }),
    );

    expect(response.status).toBe(502);
    expect(await readJson(response)).toEqual({
      ok: false,
      runId: 'run-1',
      error: 'Falha ao baixar a planilha de estoque (HTTP 503).',
    });
    expect(dependencies.runs.fail).toHaveBeenCalledWith(
      'run-1',
      'Falha ao baixar a planilha de estoque (HTTP 503).',
    );
    expect(dependencies.syncSnapshot).not.toHaveBeenCalled();
  });

  it('returns 502 when Google does not return CSV', async () => {
    const dependencies = createDependencies({
      fetchCsv: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        contentType: 'text/html',
        text: '<html>login</html>',
      }),
    });
    const handler = createInventorySyncHandler(dependencies);

    const response = await handler(
      new Request('https://example.test', { method: 'POST' }),
    );

    expect(response.status).toBe(502);
    expect(await readJson(response)).toMatchObject({
      ok: false,
      error: 'A planilha não retornou conteúdo CSV.',
    });
    expect(dependencies.runs.fail).toHaveBeenCalledWith(
      'run-1',
      'A planilha não retornou conteúdo CSV.',
    );
  });

  it('returns 422 and performs no RPC write when sheet validation fails', async () => {
    const dependencies = createDependencies({
      fetchCsv: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        contentType: 'text/csv',
        text: 'ID Variação,Unidades na loja\n123,-1',
      }),
    });
    const handler = createInventorySyncHandler(dependencies);

    const response = await handler(
      new Request('https://example.test', { method: 'POST' }),
    );

    expect(response.status).toBe(422);
    expect(await readJson(response)).toMatchObject({
      ok: false,
      error: 'Unidades na loja inválido na linha 2.',
    });
    expect(dependencies.syncSnapshot).not.toHaveBeenCalled();
    expect(dependencies.runs.fail).toHaveBeenCalledWith(
      'run-1',
      'Unidades na loja inválido na linha 2.',
    );
  });

  it('returns a sanitized RPC error and records the failed run', async () => {
    const dependencies = createDependencies({
      syncSnapshot: vi
        .fn()
        .mockRejectedValue(new Error('  database\n rejected   the snapshot  ')),
    });
    const handler = createInventorySyncHandler(dependencies);

    const response = await handler(
      new Request('https://example.test', { method: 'POST' }),
    );

    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({
      ok: false,
      runId: 'run-1',
      error: 'database rejected the snapshot',
    });
    expect(dependencies.runs.fail).toHaveBeenCalledWith(
      'run-1',
      'database rejected the snapshot',
    );
  });

  it('still returns the original error when failure logging also fails', async () => {
    const runs = createRunStore();
    runs.fail.mockRejectedValue(new Error('log unavailable'));
    const dependencies = createDependencies({
      runs,
      syncSnapshot: vi.fn().mockRejectedValue(new Error('RPC unavailable')),
    });
    const handler = createInventorySyncHandler(dependencies);

    const response = await handler(
      new Request('https://example.test', { method: 'POST' }),
    );

    expect(response.status).toBe(500);
    expect(await readJson(response)).toMatchObject({
      error: 'RPC unavailable',
    });
  });
});

describe('parseInventorySyncSummary', () => {
  it('accepts the exact RPC result contract', () => {
    expect(parseInventorySyncSummary(summary)).toEqual(summary);
  });

  it.each([
    null,
    {},
    { ...summary, scanned: -1 },
    { ...summary, changed: 2, unchanged: 0 },
    { ...summary, changes: [{ nuvemshopVariantId: '123' }] },
  ])('rejects malformed RPC data', (value) => {
    expect(() => parseInventorySyncSummary(value)).toThrowError(
      'Resposta inválida da sincronização no Supabase.',
    );
  });
});
