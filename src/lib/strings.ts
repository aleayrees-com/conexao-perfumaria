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
