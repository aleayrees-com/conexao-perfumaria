import Link from 'next/link';

import { PageHeading, PageShell } from '@/components/store-layout';

export default function NotFound() {
  return (
    <PageShell className="not-found-page">
      <PageHeading eyebrow="404" title="Essa rota não está no frasco">
        <p>
          A página não existe, mas a curadoria segue pronta para você escolher
          seu próximo perfume.
        </p>
      </PageHeading>
      <div className="hero-actions">
        <Link className="button" href="/produtos">
          Abrir catálogo
        </Link>
        <Link className="button ghost" href="/">
          Voltar ao início
        </Link>
      </div>
    </PageShell>
  );
}
