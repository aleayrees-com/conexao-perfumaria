import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { Suspense } from 'react';

import { AnalyticsTags } from '@/components/analytics-tags';
import { AppChrome } from '@/components/app-chrome';
import { PageViewTracker } from '@/components/page-view-tracker';
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
    default: 'Conexão Perfumaria',
    template: '%s | Conexão Perfumaria',
  },
  description:
    'Perfumes árabes, importados, body splash e presentes com checkout online.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Conexão Perfumaria',
    description:
      'Perfumes, body splash e presentes com pagamento online e atendimento direto.',
    siteName: 'Conexão Perfumaria',
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
        <AnalyticsTags />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
