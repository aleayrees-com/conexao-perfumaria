import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('banners promocionais da home', () => {
  it('remove a campanha de aniversário e mantém o banner institucional', () => {
    expect(pageSource).not.toContain("id: 'aniversario'");
    expect(pageSource).not.toContain('/brand/conexao-anniversary-banner.jpeg');
    expect(pageSource).toContain("id: 'historia'");
  });
});
