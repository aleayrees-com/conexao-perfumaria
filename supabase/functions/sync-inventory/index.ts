import { createClient } from '@supabase/supabase-js';

import {
  createInventorySyncHandler,
  parseInventorySyncSummary,
  type InventoryRunStore,
  type InventorySyncSummary,
} from '../_shared/inventory-handler';
import type { InventoryRow } from '../_shared/inventory-sheet';

interface DenoRuntime {
  readonly env: {
    readonly get: (name: string) => string | undefined;
  };
  readonly serve: (
    handler: (request: Request) => Response | Promise<Response>,
  ) => void;
}

const Deno = (globalThis as unknown as { readonly Deno: DenoRuntime }).Deno;

const sheetCsvUrl =
  'https://docs.google.com/spreadsheets/d/1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4/export?format=csv&gid=257370644';

function getEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}.`);
  }

  return value;
}

const client = createClient(
  getEnv('SUPABASE_URL'),
  getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

function throwDatabaseError(
  action: string,
  error: { readonly message: string } | null,
): void {
  if (error) {
    throw new Error(`${action}: ${error.message}`);
  }
}

const runs: InventoryRunStore = {
  async start(dryRun) {
    const { data, error } = await client
      .from('inventory_sync_runs')
      .insert({
        mode: dryRun ? 'dry_run' : 'live',
        status: 'running',
        metadata: {
          spreadsheetId: '1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4',
          sheetId: 257370644,
          sheetName: 'Produtos',
        },
      })
      .select('id')
      .single();

    throwDatabaseError('Falha ao iniciar o registro da sincronização', error);

    if (!data?.id) {
      throw new Error('Supabase não retornou o ID da sincronização.');
    }

    return String(data.id);
  },

  async succeed(runId, summary) {
    const { error } = await client
      .from('inventory_sync_runs')
      .update({
        status: 'success',
        scanned_count: summary.scanned,
        changed_count: summary.changed,
        unchanged_count: summary.unchanged,
        finished_at: new Date().toISOString(),
        error_summary: null,
      })
      .eq('id', runId);

    throwDatabaseError('Falha ao concluir o registro da sincronização', error);
  },

  async fail(runId, errorSummary) {
    const { error } = await client
      .from('inventory_sync_runs')
      .update({
        status: 'error',
        finished_at: new Date().toISOString(),
        error_summary: errorSummary,
      })
      .eq('id', runId);

    throwDatabaseError('Falha ao registrar o erro da sincronização', error);
  },
};

async function syncSnapshot(
  rows: readonly InventoryRow[],
  dryRun: boolean,
): Promise<InventorySyncSummary> {
  const inventoryRows = rows.map((row) => ({
    nuvemshopVariantId: row.nuvemshopVariantId,
    stock: row.stock,
  }));
  const { data, error } = await client.rpc('sync_inventory_snapshot', {
    inventory_rows: inventoryRows,
    dry_run: dryRun,
  });

  throwDatabaseError('Falha ao sincronizar o estoque', error);

  return parseInventorySyncSummary(data);
}

const handler = createInventorySyncHandler({
  sheetCsvUrl,
  async fetchCsv(url) {
    const response = await fetch(url, {
      headers: { Accept: 'text/csv' },
      redirect: 'follow',
    });

    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      text: await response.text(),
    };
  },
  runs,
  syncSnapshot,
});

Deno.serve(handler);
