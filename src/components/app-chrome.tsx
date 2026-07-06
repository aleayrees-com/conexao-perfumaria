'use client';

import { usePathname } from 'next/navigation';

import { CartDrawer } from '@/components/cart-drawer';
import { CartProvider } from '@/components/cart-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export function AppChrome({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname.startsWith('/admin') || pathname.startsWith('/login')) {
    return <main className="admin-site-main">{children}</main>;
  }

  return (
    <CartProvider>
      <SiteHeader />
      <CartDrawer />
      <main className="site-main">{children}</main>
      <SiteFooter />
    </CartProvider>
  );
}
