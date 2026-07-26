type EnvLike = Record<string, string | undefined>;

function normalizeEnvValue(value: string | undefined): string | null {
  const trimmedValue = value?.trim();

  if (!trimmedValue || trimmedValue === '""' || trimmedValue === "''") {
    return null;
  }

  return trimmedValue;
}

export function readOptionalEnv(env: EnvLike, name: string): string | null {
  return normalizeEnvValue(env[name]);
}

export function isSupabaseAdminEnvConfigured(
  env: EnvLike = process.env,
): boolean {
  return Boolean(
    readOptionalEnv(env, 'SUPABASE_URL') &&
    readOptionalEnv(env, 'SUPABASE_SERVICE_ROLE_KEY'),
  );
}

export function isSupabaseDbUrlConfigured(env: EnvLike = process.env): boolean {
  return Boolean(readOptionalEnv(env, 'SUPABASE_DB_URL'));
}
