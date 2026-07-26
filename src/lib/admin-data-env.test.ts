import {
  isSupabaseAdminEnvConfigured,
  isSupabaseDbUrlConfigured,
} from '@/lib/admin-env';

describe('admin data env helpers', () => {
  test('treats missing and placeholder Supabase admin values as unconfigured', () => {
    expect(isSupabaseAdminEnvConfigured({})).toBe(false);
    expect(
      isSupabaseAdminEnvConfigured({
        SUPABASE_URL: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
      }),
    ).toBe(false);
    expect(
      isSupabaseAdminEnvConfigured({
        SUPABASE_URL: '""',
        SUPABASE_SERVICE_ROLE_KEY: '""',
      }),
    ).toBe(false);
  });

  test('accepts non-empty Supabase admin and Postgres values', () => {
    expect(
      isSupabaseAdminEnvConfigured({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      }),
    ).toBe(true);
    expect(
      isSupabaseDbUrlConfigured({
        SUPABASE_DB_URL: 'postgresql://postgres:secret@example:5432/postgres',
      }),
    ).toBe(true);
  });
});
