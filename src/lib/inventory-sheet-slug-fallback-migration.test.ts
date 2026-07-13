import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../supabase/migrations/20260713191000_inventory_sheet_slug_fallback.sql',
  import.meta.url,
);

describe('inventory sheet slug fallback migration', () => {
  let sql: string;

  beforeAll(async () => {
    sql = await readFile(migrationUrl, 'utf8');
  });

  it('requests the product link with the variant ID and stock', () => {
    expect(sql).toContain('tq=select%20B%2CJ%2CL');
    expect(sql).toContain(
      `'"ID Variação","Unidades na loja","Link do produto"'`,
    );
    expect(sql).toContain('cardinality(csv_fields) <> 3');
    expect(sql).toContain("substring(product_url from '/produtos/([^/?#]+)')");
  });

  it('prefers direct IDs and falls back to one existing variant by product slug', () => {
    expect(sql).toContain('create temporary table inventory_sheet_input');
    expect(sql).toContain('create temporary table inventory_sheet_resolved');
    expect(sql).toContain('direct_variant.nuvemshop_variant_id');
    expect(sql).toContain('fallback_match.variant_count = 1');
    expect(sql).toContain('product.slug = incoming.product_slug');
    expect(sql).toContain('ID Variação sem correspondência segura');
  });

  it('rejects duplicate targets and preserves database identifiers', () => {
    expect(sql).toContain('ID Variação resolvido em duplicidade');
    expect(sql).toContain('public.sync_inventory_snapshot(snapshot, dry_run)');
    expect(sql).not.toContain('set nuvemshop_variant_id');
    expect(sql).not.toContain('set nuvemshop_product_id');
  });

  it('reports how many rows required the slug fallback', () => {
    expect(sql).toContain("'fallbackMatched', fallback_count");
    expect(sql).toContain("'fallbackMatched', fallback_count");
    expect(sql).toContain("metadata = metadata || jsonb_build_object(");
  });
});
