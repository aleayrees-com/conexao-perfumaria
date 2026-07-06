import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdmin } from '@/lib/admin-auth';

export const metadata = {
  title: 'Admin | Conexão Perfumaria',
};

export default async function AdminLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  await requireAdmin();

  return <AdminShell>{children}</AdminShell>;
}
