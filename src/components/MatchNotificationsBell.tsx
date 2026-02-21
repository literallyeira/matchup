'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';

const SEEN_STORAGE_KEY = 'matchup_seen_match_ids';

function getSeenIds(characterId: number): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`${SEEN_STORAGE_KEY}_${characterId}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function markAsSeen(characterId: number, matchIds: string[]) {
  if (typeof window === 'undefined' || !matchIds.length) return;
  try {
    const prev = getSeenIds(characterId);
    matchIds.forEach((id) => prev.add(id));
    localStorage.setItem(`${SEEN_STORAGE_KEY}_${characterId}`, JSON.stringify([...prev]));
  } catch {
    // ignore
  }
}

export function MatchNotificationsBell() {
  const { data: session, status } = useSession();
  const [characterId, setCharacterId] = useState<number | null>(null);
  const [matches, setMatches] = useState<Array<{ id: string; created_at: string; matchedWith: { id: string; first_name: string; last_name: string; photo_url?: string | null } }>>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) {
      setCharacterId(null);
      setMatches([]);
      return;
    }
    try {
      const raw = localStorage.getItem('matchup_selected_character');
      if (raw) {
        const saved = JSON.parse(raw) as { id: number };
        if (saved?.id) setCharacterId(saved.id);
        else setCharacterId(null);
      } else setCharacterId(null);
    } catch {
      setCharacterId(null);
    }
  }, [status, session?.user]);

  const fetchMatches = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/my-matches?characterId=${characterId}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.matches)) setMatches(data.matches);
      else setMatches([]);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    if (!characterId) return;
    fetchMatches();
    const t = setInterval(fetchMatches, 60 * 1000);
    return () => clearInterval(t);
  }, [characterId, fetchMatches]);

  const seenIds = characterId ? getSeenIds(characterId) : new Set<string>();
  const newMatches = matches.filter((m) => !seenIds.has(m.id));
  const newCount = newMatches.length;

  const goToMatches = () => {
    if (characterId && matches.length) markAsSeen(characterId, matches.map((m) => m.id));
    setOpen(false);
  };

  if (status !== 'authenticated' || !session?.user || characterId == null) return null;

  return (
    <div className="fixed top-4 right-4 z-40 flex flex-col items-end">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative w-11 h-11 rounded-xl bg-[var(--matchup-bg-card)] border border-[var(--matchup-border)] shadow-lg flex items-center justify-center text-[var(--matchup-text-muted)] hover:text-white hover:border-[var(--matchup-primary)]/50 transition-all"
        aria-label="Bildirimler"
      >
        <i className="fa-solid fa-bell text-lg" />
        {newCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-[var(--matchup-primary)] text-white text-xs font-bold flex items-center justify-center px-1">
            {newCount > 99 ? '99+' : newCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div className="relative z-50 mt-2 w-[320px] max-h-[70vh] overflow-hidden rounded-2xl bg-[var(--matchup-bg-card)] border border-[var(--matchup-border)] shadow-2xl animate-fade-in">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <i className="fa-solid fa-heart text-[var(--matchup-primary)]" />
                Bildirimler
              </h3>
              {newCount > 0 && (
                <span className="text-xs text-[var(--matchup-primary)] font-medium">{newCount} yeni eşleşme</span>
              )}
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {loading ? (
                <div className="p-6 text-center text-[var(--matchup-text-muted)] text-sm">
                  <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <p className="mt-2">Yükleniyor...</p>
                </div>
              ) : matches.length === 0 ? (
                <div className="p-6 text-center text-[var(--matchup-text-muted)] text-sm">
                  <i className="fa-solid fa-heart-crack text-2xl mb-2 opacity-50" />
                  <p>Henüz eşleşme yok</p>
                </div>
              ) : (
                <ul className="py-2">
                  {matches.slice(0, 15).map((m) => (
                    <li key={m.id} className="px-3 py-2 flex items-center gap-3 hover:bg-white/5">
                      {m.matchedWith.photo_url ? (
                        <Image src={m.matchedWith.photo_url} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[var(--matchup-primary)]/20 flex items-center justify-center flex-shrink-0">
                          <i className="fa-solid fa-user text-[var(--matchup-primary)]/70" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {m.matchedWith.first_name} {m.matchedWith.last_name}
                        </p>
                        <p className="text-xs text-[var(--matchup-text-muted)]">
                          {!seenIds.has(m.id) ? <span className="text-[var(--matchup-primary)]">Yeni eşleşme</span> : 'Eşleşme'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-3 border-t border-white/10">
              <Link
                href="/?tab=matches"
                onClick={goToMatches}
                className="block w-full py-2.5 rounded-xl bg-[var(--matchup-primary)] text-white text-center text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Eşleşmelere git
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
