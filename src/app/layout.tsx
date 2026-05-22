import type { Metadata } from 'next';
import { Fraunces, Manrope } from 'next/font/google';

import { CartDrawer } from '@/components/cart-drawer';
import { CartProvider } from '@/components/cart-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { publicEnv } from '@/lib/env';

import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
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
      'Catalogo independente com pedido rapido pelo WhatsApp. Estoque e PIX confirmados pela equipe.',
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
      <body className={`${display.variable} ${sans.variable}`}>
        <CartProvider>
          <SiteHeader />
          <CartDrawer />
          <main>{children}</main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
