'use client';

import { useMemo, useState } from 'react';
import Image, { type ImageProps } from 'next/image';
import { getImageCandidates, isImgurUrl } from '@/lib/images';

type RemoteImageProps = Omit<ImageProps, 'src'> & {
  src: string;
};

export function RemoteImage({ src, alt, onError, unoptimized, ...props }: RemoteImageProps) {
  const candidates = useMemo(() => getImageCandidates(src), [src]);
  const [candidateIndices, setCandidateIndices] = useState<Record<string, number>>({});
  const candidateIndex = candidateIndices[src] || 0;

  const currentSrc = candidates[candidateIndex] || src;
  const shouldBypassOptimizer = unoptimized ?? isImgurUrl(currentSrc);

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      unoptimized={shouldBypassOptimizer}
      referrerPolicy={shouldBypassOptimizer ? 'no-referrer' : undefined}
      onError={(event) => {
        if (candidateIndex < candidates.length - 1) {
          setCandidateIndices((prev) => ({ ...prev, [src]: candidateIndex + 1 }));
          return;
        }
        onError?.(event);
      }}
    />
  );
}

