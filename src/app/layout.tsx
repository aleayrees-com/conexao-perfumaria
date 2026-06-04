import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';

import { CartDrawer } from '@/components/cart-drawer';
import { CartProvider } from '@/components/cart-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { publicEnv } from '@/lib/env';

import './globals.css';

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: 'Conexao Perfumaria',
    template: '%s | Conexao Perfumaria',
  },
  description:
    'Perfumes arabes, importados, body splash e presentes com pedido rapido pelo WhatsApp.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Conexao Perfumaria',
    description:
      'Perfumes, body splash e presentes com atendimento direto pelo WhatsApp.',
    siteName: 'Conexao Perfumaria',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} site-body`}>
        <CartProvider>
          <SiteHeader />
          <CartDrawer />
          <main className="site-main">{children}</main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
