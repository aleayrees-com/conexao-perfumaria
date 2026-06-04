import Link from 'next/link';

import { PageHeading, PageShell } from '@/components/store-layout';

export default function NotFound() {
  return (
    <PageShell className="not-found-page">
      <PageHeading eyebrow="404" title="Essa rota nao esta no frasco">
        <p>
          A pagina nao existe, mas a curadoria segue pronta para voce escolher
          seu proximo perfume.
        </p>
      </PageHeading>
      <div className="hero-actions">
        <Link className="button" href="/produtos">
          Abrir catalogo
        </Link>
        <Link className="button ghost" href="/">
          Voltar ao inicio
        </Link>
      </div>
    </PageShell>
  );
}
