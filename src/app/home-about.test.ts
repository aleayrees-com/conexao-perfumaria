import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(
  new URL('./globals.css', import.meta.url),
  'utf8',
);

describe('apresentação institucional da home', () => {
  it('remove a arte lateral e preserva apenas o conteúdo institucional', () => {
    expect(pageSource).not.toContain('conexao-history-story-banner.png');
    expect(pageSource).toContain('className="about-store-content"');
    expect(pageSource).toContain('11 anos de história conectando pessoas');
  });

  it('centraliza o conteúdo em uma largura ampla, porém limitada', () => {
    expect(stylesSource).toMatch(
      /\.about-store\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*860px\);[^}]*justify-content:\s*center;/s,
    );
    expect(stylesSource).toMatch(
      /\.about-store h2\s*\{[^}]*max-width:\s*18ch;[^}]*margin-inline:\s*auto;/s,
    );
  });
});
