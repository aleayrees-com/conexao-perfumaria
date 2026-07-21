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

  it('compacta somente o banner e os cards de perfumes no desktop', () => {
    expect(globalStyles).not.toContain('width: min(1180px, calc(100% - 40px))');
    expect(globalStyles).toContain('height: clamp(280px, 30vw, 360px)');
    expect(globalStyles).toContain('aspect-ratio: 1 / 0.82');
    expect(globalStyles).toContain('min-height: 164px');
  });
});
