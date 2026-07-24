'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { logoutAdminAction } from '@/app/login/actions';

const navItems = [
  { href: '/admin', label: 'Painel' },
  { href: '/admin/produtos', label: 'Produtos' },
  { href: '/admin/produtos/edicao-em-massa', label: 'Inventário' },
  { href: '/admin/categorias', label: 'Categorias' },
  { href: '/admin/pedidos', label: 'Vendas' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/estatisticas', label: 'Estatísticas' },
] as const;

export function AdminShell({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          Conexão Admin
        </Link>
        <nav>
          {navItems.map((item) => {
            const isCurrent =
              item.href === '/admin'
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            return (
              <Link
                aria-current={isCurrent ? 'page' : undefined}
                className={isCurrent ? 'is-current' : undefined}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
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
