'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function RefTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (!ref) return;

    fetch('/api/track-ref', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref }),
    }).catch(() => {});
  }, [searchParams]);

  return null;
}
