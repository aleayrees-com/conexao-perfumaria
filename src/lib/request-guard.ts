import 'server-only';

interface HeaderReader {
  get(name: string): string | null;
}

interface RateLimitBucket {
  readonly resetAt: number;
  count: number;
}

interface RateLimitInput {
  readonly key: string;
  readonly limit: number;
  readonly windowMs: number;
}

interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

const buckets = new Map<string, RateLimitBucket>();
const MAX_BUCKETS = 5000;

function pruneBuckets(now: number): void {
  if (buckets.size < MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function readClientIp(headers: HeaderReader): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

export function checkRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now();
  pruneBuckets(now);

  const current = buckets.get(input.key);

  if (!current || current.resetAt <= now) {
    buckets.set(input.key, {
      count: 1,
      resetAt: now + input.windowMs,
    });

    return { allowed: true, retryAfterSeconds: 0 };
  }

  current.count += 1;

  return {
    allowed: current.count <= input.limit,
    retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
  };
}

export function hasAllowedOrigin(headers: HeaderReader): boolean {
  const origin = headers.get('origin');

  if (!origin) {
    return true;
  }

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHost = headers.get('host')?.toLowerCase();

    return Boolean(requestHost && originHost === requestHost);
  } catch {
    return false;
  }
}
