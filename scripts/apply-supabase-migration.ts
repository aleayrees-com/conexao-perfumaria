import { readdir, readFile } from 'node:fs/promises';

import pg from 'pg';

const MIGRATIONS_DIR = new URL('../supabase/migrations/', import.meta.url);
const INITIAL_MIGRATION = '20260521210000_initial_catalog_admin.sql';
const ADMIN_ECOMMERCE_MIGRATION = '20260614090000_admin_ecommerce_tracking.sql';

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

function createPgClient(connectionString: string): pg.Client {
  const url = new URL(connectionString);

  return new pg.Client({
    host: url.hostname,
    port: Number(url.port || '5432'),
    database: decodeURIComponent(url.pathname.replace(/^\//, '') || 'postgres'),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: {
      rejectUnauthorized: false,
    },
  });
}

async function listMigrationFiles(): Promise<readonly string[]> {
  const files = await readdir(MIGRATIONS_DIR);

  return files
    .filter((file) => file.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));
}

async function ensureMigrationLedger(client: pg.Client): Promise<void> {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function isMigrationApplied(
  client: pg.Client,
  filename: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    'select exists(select 1 from public.schema_migrations where filename = $1) as exists',
    [filename],
  );

  return Boolean(result.rows[0]?.exists);
}

async function markMigrationApplied(
  client: pg.Client,
  filename: string,
): Promise<void> {
  await client.query(
    'insert into public.schema_migrations (filename) values ($1) on conflict (filename) do nothing',
    [filename],
  );
}

async function relationExists(
  client: pg.Client,
  relationName: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    'select to_regclass($1) is not null as exists',
    [relationName],
  );

  return Boolean(result.rows[0]?.exists);
}

async function shouldSkipExistingMigration(
  client: pg.Client,
  filename: string,
): Promise<boolean> {
  if (filename === INITIAL_MIGRATION) {
    return (
      (await relationExists(client, 'public.categories')) &&
      (await relationExists(client, 'public.products')) &&
      (await relationExists(client, 'public.product_variants'))
    );
  }

  if (filename === ADMIN_ECOMMERCE_MIGRATION) {
    return (
      (await relationExists(client, 'public.tracking_events')) &&
      (await relationExists(client, 'public.order_events'))
    );
  }

  return false;
}

async function applyMigrationFile(
  client: pg.Client,
  filename: string,
): Promise<void> {
  if (await isMigrationApplied(client, filename)) {
    console.log(`Migration ignorada (ja aplicada): ${filename}`);
    return;
  }

  if (await shouldSkipExistingMigration(client, filename)) {
    await markMigrationApplied(client, filename);
    console.log(`Migration marcada como aplicada: ${filename}`);
    return;
  }

  const sql = await readFile(new URL(filename, MIGRATIONS_DIR), 'utf8');

  await client.query('begin');

  try {
    await client.query(sql);
    await markMigrationApplied(client, filename);
    await client.query('commit');
    console.log(`Migration aplicada: ${filename}`);
  } catch (error: unknown) {
    await client.query('rollback');
    throw error;
  }
}

async function applySupabaseMigration(): Promise<void> {
  const connectionString = getEnv('SUPABASE_DB_URL');
  assertAllowedSupabaseProject(connectionString);

  const client = createPgClient(connectionString);

  await client.connect();

  try {
    await ensureMigrationLedger(client);

    for (const filename of await listMigrationFiles()) {
      await applyMigrationFile(client, filename);
    }
  } finally {
    await client.end();
  }

  console.log('Migrations Supabase aplicadas com sucesso.');
}

try {
  await applySupabaseMigration();
} catch (error: unknown) {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
}
