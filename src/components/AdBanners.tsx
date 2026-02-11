'use client';

import { useState, useEffect } from 'react';

interface Ad {
  id: string;
  position: string;
  image_url: string;
  link_url: string;
  expires_at: string;
}

export default function AdBanners() {
  const [leftAd, setLeftAd] = useState<Ad | null>(null);
  const [rightAd, setRightAd] = useState<Ad | null>(null);

  useEffect(() => {
    fetch('/api/ads')
      .then((res) => res.json())
      .then((data) => {
        setLeftAd(data.left || null);
        setRightAd(data.right || null);
      })
      .catch(() => {});
  }, []);

  if (!leftAd && !rightAd) return null;

  return (
    <>
      {/* Sol reklam */}
      {leftAd && (
        <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40 hidden xl:block">
          <a
            href={leftAd.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="relative w-[160px] ml-3">
              <div className="rounded-2xl overflow-hidden border border-white/10 shadow-lg shadow-black/50 transition-all duration-300 group-hover:border-pink-500/30 group-hover:shadow-pink-500/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={leftAd.image_url}
                  alt="Reklam"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-[9px] text-gray-500 px-2 py-0.5 rounded-full border border-white/5">
                Reklam
              </div>
            </div>
          </a>
        </div>
      )}

      {/* Sağ reklam */}
      {rightAd && (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 hidden xl:block">
          <a
            href={rightAd.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="relative w-[160px] mr-3">
              <div className="rounded-2xl overflow-hidden border border-white/10 shadow-lg shadow-black/50 transition-all duration-300 group-hover:border-pink-500/30 group-hover:shadow-pink-500/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={rightAd.image_url}
                  alt="Reklam"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-[9px] text-gray-500 px-2 py-0.5 rounded-full border border-white/5">
                Reklam
              </div>
            </div>
          </a>
        </div>
      )}
    </>
  );
}
