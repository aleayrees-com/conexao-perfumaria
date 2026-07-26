import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import ContactPage from '@/app/contato/page';

it('shows the Conexão Perfumaria location in an embedded Google Map', () => {
  const markup = renderToStaticMarkup(createElement(ContactPage));

  expect(markup).toContain('id="localizacao"');
  expect(markup).toContain(
    'src="https://www.google.com/maps?output=embed&amp;cid=17040870420316839582"',
  );
  expect(markup).toContain('Abrir no Google Maps');
});
