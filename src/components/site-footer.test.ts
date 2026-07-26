import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { expect, it } from 'vitest';

import { SiteFooter } from '@/components/site-footer';

it('credits Alexandre Ayres in the footer', () => {
  const markup = renderToStaticMarkup(createElement(SiteFooter));

  expect(markup).toContain('site feito por @alexandreayres_');
});
