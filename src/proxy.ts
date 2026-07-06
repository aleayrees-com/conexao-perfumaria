import { NextResponse, type NextRequest } from 'next/server';

const DEFAULT_ADMIN_HOSTS =
  'admin.conexaoimportados.com.br,adm.conexaoimportados.com.br';
const ADMIN_SHORT_PATHS = ['/categorias', '/pedidos', '/produtos'] as const;

function getHostname(request: NextRequest): string {
  return (request.headers.get('host') ?? '').split(':')[0]?.toLowerCase() ?? '';
}

function getAdminHosts(): readonly string[] {
  return (process.env.ADMIN_HOST ?? DEFAULT_ADMIN_HOSTS)
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.png' ||
    pathname === '/apple-icon.png' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

function redirectToAdminPath(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url);
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (
    isStaticAsset(pathname) ||
    pathname.startsWith('/api') ||
    !getAdminHosts().includes(getHostname(request))
  ) {
    return NextResponse.next();
  }

  if (pathname === '/') {
    return redirectToAdminPath(request, '/admin');
  }

  if (
    ADMIN_SHORT_PATHS.some(
      (shortPath) =>
        pathname === shortPath || pathname.startsWith(`${shortPath}/`),
    )
  ) {
    return redirectToAdminPath(request, `/admin${pathname}`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
