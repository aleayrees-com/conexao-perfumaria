import { buildBulkProductsCsv } from '@/lib/admin-product-bulk';
import { requireAdmin } from '@/lib/admin-auth';
import { listAdminProductBulkRows } from '@/lib/admin-data';

export async function GET(): Promise<Response> {
  await requireAdmin();

  const csv = buildBulkProductsCsv(await listAdminProductBulkRows());

  return new Response(csv, {
    headers: {
      'content-disposition':
        'attachment; filename="conexao-produtos-edicao-em-massa.csv"',
      'content-type': 'text/csv; charset=utf-8',
    },
  });
}
