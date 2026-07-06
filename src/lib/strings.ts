export function slugFromUrl(url: string): string {
  const parsed = new URL(url);
  const parts = parsed.pathname.split('/').filter(Boolean);

  return parts.at(-1) ?? '';
}

export function normalizeImageUrl(url: string): string {
  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  return url;
}

const portugueseDisplayReplacements: ReadonlyArray<readonly [RegExp, string]> =
  [
    [/\bConexao\b/g, 'Conexão'],
    [/\bCatalogo\b/g, 'Catálogo'],
    [/\bcatalogo\b/g, 'catálogo'],
    [/\bArabes\b/g, 'Árabes'],
    [/\barabes\b/g, 'árabes'],
    [/\bselecao\b/g, 'seleção'],
    [/\bperfumacao\b/g, 'perfumação'],
    [/\bfragancia\b/g, 'fragrância'],
    [/\bfragrancias\b/g, 'fragrâncias'],
    [/\bopcoes\b/g, 'opções'],
    [/\bopcao\b/g, 'opção'],
    [/\bdisponiveis\b/g, 'disponíveis'],
    [/\bdisponivel\b/g, 'disponível'],
    [/\bconfianca\b/g, 'confiança'],
    [/\bfisica\b/g, 'física'],
    [/\brapido\b/g, 'rápido'],
    [/\bduvidas\b/g, 'dúvidas'],
    [/\bindicacoes\b/g, 'indicações'],
    [/\bconfirmacao\b/g, 'confirmação'],
    [/\bcomecar\b/g, 'começar'],
    [/\bproximo\b/g, 'próximo'],
    [/\bEndereco\b/g, 'Endereço'],
    [/\bVariacao\b/g, 'Variação'],
    [/\bNao\b/g, 'Não'],
    [/\bVoce\b/g, 'Você'],
    [/\bAte\b/g, 'Até'],
    [/\bSo\b/g, 'Só'],
  ];

export function formatPortugueseDisplayText(value: string): string {
  return portugueseDisplayReplacements.reduce(
    (formattedValue, [pattern, replacement]) =>
      formattedValue.replace(pattern, replacement),
    value,
  );
}
