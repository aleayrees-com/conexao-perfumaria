import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(
  new URL('./globals.css', import.meta.url),
  'utf8',
);

describe('banners promocionais da home', () => {
  it('remove a campanha de aniversário e mantém o banner institucional', () => {
    expect(pageSource).not.toContain("id: 'aniversario'");
    expect(pageSource).not.toContain('/brand/conexao-anniversary-banner.jpeg');
    expect(pageSource).toContain("id: 'historia'");
  });

  it('reduz a escala da home sem cortar a arte do banner no desktop', () => {
    expect(globalStyles).toContain('width: min(1180px, calc(100% - 32px))');
    expect(globalStyles).toContain('max-width: 980px');
    expect(globalStyles).toContain('height: auto');
    expect(globalStyles).toContain('aspect-ratio: 1 / 0.82');
    expect(globalStyles).toContain('min-height: 148px');
    expect(globalStyles).toMatch(
      /\.home-page \.promo-image-link img \{\s+width: 100%;\s+height: auto;\s+object-fit: contain;/,
    );
  });
});
