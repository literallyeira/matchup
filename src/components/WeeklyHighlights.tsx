'use client';

import { useEffect, useState } from 'react';
import type { Application } from '@/lib/supabase';
import { getInlineBadges } from '@/lib/badges-client';
import { RemoteImage } from '@/components/RemoteImage';

type HighlightProfile = Application & {
  liked_count?: number;
  match_count?: number;
  reason: string;
};

type HighlightSection = {
  key: 'liked' | 'matched' | 'active';
  title: string;
  icon: string;
  profiles: HighlightProfile[];
};

function formatLastActive(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  if (mins < 1) return 'Şimdi aktif';
  if (mins < 60) return `${mins} dk önce aktif`;
  if (hours < 24) return `${hours} saat önce aktif`;
  if (days < 7) return `${days} gün önce aktif`;
  return null;
}

export function WeeklyHighlights({ maxItems = 6 }: { maxItems?: number }) {
  const [sections, setSections] = useState<HighlightSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/highlights')
      .then((res) => (res.ok ? res.json() : { sections: [] }))
      .then((data) => {
        if (!cancelled) {
          setEnabled(data.enabled === true);
          setSections(
            Array.isArray(data.sections)
              ? data.sections.map((section: HighlightSection) => ({
                  ...section,
                  profiles: Array.isArray(section.profiles) ? section.profiles.slice(0, maxItems) : [],
                }))
              : []
          );
        }
      })
      .catch(() => {
        if (!cancelled) setSections([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [maxItems]);

  if (!isLoading && (!enabled || sections.length === 0)) return null;

  return (
    <section className="w-full mb-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <i className="fa-solid fa-trophy text-amber-400 text-sm" />
        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Bu Haftanın Öne Çıkanları</span>
      </div>
      <p className="text-[var(--matchup-text-muted)] text-sm mb-4">
        Bu hafta en çok öne çıkan profiller 3 farklı kategoride.
      </p>

      <div className="space-y-5">
        {isLoading
          ? Array.from({ length: 3 }).map((_, sectionIndex) => (
              <div key={sectionIndex}>
                <div className="h-4 bg-white/10 rounded w-40 mb-3 animate-pulse" />
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {Array.from({ length: Math.min(maxItems, 3) }).map((__, cardIndex) => (
                    <div
                      key={cardIndex}
                      className="min-w-[220px] rounded-2xl border border-white/10 bg-white/[0.04] p-3 animate-pulse"
                    >
                      <div className="w-full aspect-[4/5] rounded-xl bg-white/10 mb-3" />
                      <div className="h-4 bg-white/10 rounded mb-2" />
                      <div className="h-3 bg-white/10 rounded w-2/3" />
                    </div>
                  ))}
                </div>
              </div>
            ))
          : sections.map((section) => (
              <div key={section.key}>
                <div className="flex items-center gap-2 mb-3">
                  <i className={`fa-solid ${section.icon} text-sm text-amber-300`} />
                  <h3 className="text-sm font-semibold text-white">{section.title}</h3>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                  {section.profiles.map((profile) => {
                    const badges = getInlineBadges(profile).slice(0, 2);
                    return (
                      <article
                        key={`${section.key}-${profile.id}`}
                        className="min-w-[220px] max-w-[220px] rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04] snap-start"
                      >
                        <div className="relative aspect-[4/5] bg-[var(--matchup-bg-input)]">
                          {profile.photo_url ? (
                            <RemoteImage
                              src={profile.photo_url}
                              alt={`${profile.first_name} ${profile.last_name}`}
                              fill
                              className="object-cover"
                              sizes="220px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/50">
                              <i className="fa-solid fa-user text-4xl" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                          <div className="absolute top-3 left-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/20">
                              <i className="fa-solid fa-sparkles" /> {profile.reason}
                            </span>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <h3 className="font-semibold text-white truncate">
                              {profile.first_name} {profile.last_name}
                            </h3>
                            <p className="text-xs text-white/70">
                              {profile.age} · {profile.character_name || 'MatchUp üyesi'}
                            </p>
                          </div>
                        </div>
                        <div className="p-3">
                          {badges.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {badges.map((badge) => (
                                <span
                                  key={`${section.key}-${profile.id}-${badge.key}`}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.colorClass}`}
                                >
                                  <i className={`fa-solid ${badge.icon}`} style={{ fontSize: '9px' }} /> {badge.label}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="text-xs text-[var(--matchup-text-muted)]">
                            {formatLastActive(profile.last_active_at) || 'Bu hafta aktif'}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
      </div>
    </section>
  );
}

