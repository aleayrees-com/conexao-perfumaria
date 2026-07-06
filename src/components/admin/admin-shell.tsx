import Link from 'next/link';

import { logoutAdminAction } from '@/app/login/actions';

const navItems = [
  { href: '/admin', label: 'Painel' },
  { href: '/admin/produtos', label: 'Produtos' },
  { href: '/admin/produtos/edicao-em-massa', label: 'Valores e estoque' },
  { href: '/admin/categorias', label: 'Categorias' },
  { href: '/admin/pedidos', label: 'Pedidos' },
] as const;

export function AdminShell({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          Conexão Admin
        </Link>
        <nav>
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link className="admin-store-link" href="/">
          Ver loja
        </Link>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <span>Operação da loja</span>
          <form action={logoutAdminAction}>
            <button className="admin-ghost-button" type="submit">
              Sair
            </button>
          </form>
        </header>
        {children}
      </div>
    </div>
  );
}
