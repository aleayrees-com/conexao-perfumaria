export interface CepAddressLookup {
  readonly street: string;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
}

type CepFetch = (input: string, init?: RequestInit) => Promise<Response>;

interface FetchAddressByCepInput {
  readonly cep: string;
  readonly fetcher?: CepFetch;
  readonly signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readText(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizeCepInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

export function parseViaCepAddress(value: unknown): CepAddressLookup | null {
  if (!isRecord(value) || value.erro === true) {
    return null;
  }

  const city = readText(value, 'localidade');
  const state = readText(value, 'uf')?.toUpperCase().slice(0, 2) ?? null;

  if (!city || !state) {
    return null;
  }

  return {
    city,
    neighborhood: readText(value, 'bairro') ?? '',
    state,
    street: readText(value, 'logradouro') ?? '',
  };
}

export async function fetchAddressByCep({
  cep,
  fetcher = fetch,
  signal,
}: FetchAddressByCepInput): Promise<CepAddressLookup | null> {
  const normalizedCep = normalizeCepInput(cep);

  if (normalizedCep.length !== 8) {
    return null;
  }

  const response = await fetcher(
    `https://viacep.com.br/ws/${normalizedCep}/json/`,
    {
      headers: { Accept: 'application/json' },
      signal,
    },
  );

  if (!response.ok) {
    return null;
  }

  return parseViaCepAddress(await response.json().catch(() => null));
}
