'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { trackEcommerceEvent } from '@/lib/tracking';

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    trackEcommerceEvent('page_view');
  }, [pathname, searchParams]);

  return null;
}
