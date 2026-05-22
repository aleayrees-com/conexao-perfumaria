import { readFile } from 'node:fs/promises';

import pg from 'pg';

const DEFAULT_MIGRATION_FILE = new URL(
  '../supabase/migrations/20260521210000_initial_catalog_admin.sql',
  import.meta.url,
);

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}.`);
  }

  return value;
}

function assertAllowedSupabaseProject(connectionUrl: string): void {
  const blockedProjectRef = (process.env.BLOCKED_SUPABASE_PROJECT_REFS ?? '')
    .split(',')
    .map((projectRef) => projectRef.trim())
    .filter(Boolean)
    .find((projectRef) => connectionUrl.includes(projectRef));

  if (blockedProjectRef) {
    throw new Error(
      `Migration bloqueada: ${blockedProjectRef} e o Supabase do AlfraOS, nao da Conexao Perfumaria.`,
    );
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Erro desconhecido.';
}

async function applySupabaseMigration(): Promise<void> {
  const connectionString = getEnv('SUPABASE_DB_URL');
  assertAllowedSupabaseProject(connectionString);

  const sql = await readFile(DEFAULT_MIGRATION_FILE, 'utf8');
  const client = new pg.Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();

  try {
    await client.query(sql);
  } finally {
    await client.end();
  }

  console.log('Migration Supabase aplicada com sucesso.');
}

try {
  await applySupabaseMigration();
} catch (error: unknown) {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
}
