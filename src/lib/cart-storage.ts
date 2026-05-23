import type { CartItem } from '@/types/catalog';

const MAX_QUANTITY = 99;
const MAX_TEXT_LENGTH = 240;
const ALLOWED_IMAGE_HOSTS = new Set(['dcdn-us.mitiendanube.com']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();

  return text ? text.slice(0, MAX_TEXT_LENGTH) : null;
}

function sanitizePositiveInteger(
  value: unknown,
  max = Number.MAX_SAFE_INTEGER,
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const integer = Math.trunc(value);

  return integer > 0 ? Math.min(integer, max) : null;
}

function sanitizeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const url = new URL(value);

    if (!['https:', 'http:'].includes(url.protocol)) {
      return null;
    }

    return ALLOWED_IMAGE_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseStoredCart(value: unknown): readonly CartItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): CartItem[] => {
    if (!isRecord(item)) {
      return [];
    }

    const productSlug = sanitizeText(item.productSlug);
    const productName = sanitizeText(item.productName);
    const variantId = sanitizePositiveInteger(item.variantId);
    const variantLabel = sanitizeText(item.variantLabel);
    const quantity = sanitizePositiveInteger(item.quantity, MAX_QUANTITY);

    if (
      !productSlug ||
      !productName ||
      !variantId ||
      !variantLabel ||
      !quantity
    ) {
      return [];
    }

    return [
      {
        productSlug,
        productName,
        variantId,
        variantLabel,
        imageUrl: sanitizeImageUrl(item.imageUrl),
        quantity,
      },
    ];
  });
}
