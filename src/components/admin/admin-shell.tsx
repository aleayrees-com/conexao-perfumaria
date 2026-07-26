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
          <span className="admin-brand-mark">CP</span>
          <span>
            <strong>Conexão</strong>
            <small>Administração</small>
          </span>
        </Link>
        <nav aria-label="Navegação administrativa">
          <span className="admin-nav-label">Operação</span>
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <span>Loja publicada</span>
          <Link className="admin-store-link" href="/">
            Abrir vitrine
          </Link>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-topbar-kicker">Operação da loja</span>
            <strong>Conexão Perfumaria</strong>
          </div>
          <div className="admin-topbar-actions">
            <Link className="admin-ghost-button" href="/">
              Ver loja
            </Link>
            <form action={logoutAdminAction}>
              <button className="admin-ghost-button" type="submit">
                Sair
              </button>
            </form>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
