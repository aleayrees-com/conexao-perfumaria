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

  it('mantém a home compacta em telas de desktop', () => {
    expect(globalStyles).toContain('width: min(1180px, calc(100% - 40px))');
    expect(globalStyles).toContain('font-size: clamp(2.25rem, 3.4vw, 3.5rem)');
    expect(globalStyles).toContain('min-height: 186px');
  });
});
