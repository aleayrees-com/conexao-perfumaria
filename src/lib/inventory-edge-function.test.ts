import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

const functionUrl = new URL(
  '../../supabase/functions/sync-inventory/index.ts',
  import.meta.url,
);

describe('sync-inventory Edge Function adapter', () => {
  let source: string;

  beforeAll(async () => {
    source = await readFile(functionUrl, 'utf8');
  });

  it('uses the fixed native Produtos CSV export', () => {
    expect(source).toContain(
      '1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4/export?format=csv&gid=257370644',
    );
  });

  it('keeps Supabase credentials server-side', () => {
    expect(source).toContain("getEnv('SUPABASE_URL')");
    expect(source).toContain("getEnv('SUPABASE_SERVICE_ROLE_KEY')");
    expect(source).not.toContain('NEXT_PUBLIC_SUPABASE');
  });

  it('maps only variation ID and stock into the transactional RPC', () => {
    expect(source).toContain("client.rpc('sync_inventory_snapshot'");
    expect(source).toContain('nuvemshopVariantId: row.nuvemshopVariantId');
    expect(source).toContain('stock: row.stock');
    expect(source).not.toContain('sourceRow: row.sourceRow');
  });

  it('persists execution state and serves the injected handler', () => {
    expect(source).toMatch(/client\s*\.from\('inventory_sync_runs'\)/);
    expect(source).toContain('createInventorySyncHandler');
    expect(source).toContain('Deno.serve(handler)');
  });
});
