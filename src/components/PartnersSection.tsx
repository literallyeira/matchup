'use client';

import { useState, useEffect } from 'react';

interface Partner {
  id: string;
  name: string;
  logo_url: string;
  link_url: string;
  sort_order: number;
}

export default function PartnersSection() {
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    fetch('/api/partners')
      .then((res) => res.json())
      .then((data) => setPartners(Array.isArray(data) ? data : []))
      .catch(() => setPartners([]));
  }, []);

  if (partners.length === 0) return null;

  return (
    <section className="w-full py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <p className="text-center text-[var(--matchup-text-muted)] text-xs uppercase tracking-wider mb-6">
          Partnerlerimiz
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8">
          {partners.map((p) => (
            <a
              key={p.id}
              href={p.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-35 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
              title={p.name}
            >
              <img
                src={p.logo_url}
                alt={p.name}
                className="h-16 w-auto max-w-[240px] object-contain object-center"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
