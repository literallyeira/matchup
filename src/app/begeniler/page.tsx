'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import type { Application } from '@/lib/supabase';
import { PROFILE_PROMPTS } from '@/lib/prompts';
import { getInlineBadges } from '@/lib/badges-client';

interface Character {
  id: number;
  memberid: number;
  firstname: string;
  lastname: string;
}

function getGenderLabel(v: string) {
  return ({ erkek: 'Erkek', kadin: 'Kadın' }[v] || v);
}
function getPreferenceLabel(v: string) {
  return ({ heteroseksuel: 'Heteroseksüel', homoseksuel: 'Homoseksüel', biseksuel: 'Biseksüel' }[v] || v);
}

export default function BegenilerPage() {
  const { data: session, status } = useSession();
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [likedBy, setLikedBy] = useState<Application[]>([]);
  const [likedByCount, setLikedByCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string>('free');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Kayıtlı karakteri localStorage'dan al
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    try {
      const raw = localStorage.getItem('matchup_selected_character');
      if (raw) {
        const saved = JSON.parse(raw) as Character;
        const chars = (session.user as any).characters || [];
        const found = (chars as Character[]).find((c: Character) => c.id === saved.id);
        if (found) setSelectedCharacter(found);
      }
    } catch {
      // ignore
    }
  }, [status, session?.user]);

  // Veri çek
  useEffect(() => {
    if (!selectedCharacter || status !== 'authenticated') {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [likedRes, limitsRes] = await Promise.all([
          fetch(`/api/liked-me?characterId=${selectedCharacter.id}`),
          fetch(`/api/me/limits?characterId=${selectedCharacter.id}`),
        ]);

        if (!cancelled && likedRes.ok) {
          const data = await likedRes.json();
          setLikedBy(data.likedBy || []);
          setLikedByCount(data.count ?? 0);
        }
        if (!cancelled && limitsRes.ok) {
          const limData = await limitsRes.json();
          setTier(limData.tier || 'free');
        }
      } catch {
        if (!cancelled) {
          setLikedBy([]);
          setLikedByCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [selectedCharacter, status]);

  const handleLike = async (profile: Application) => {
    if (!selectedCharacter) return;
    try {
      const res = await fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toApplicationId: profile.id, characterId: selectedCharacter.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setLikedBy((prev) => prev.filter((p) => p.id !== profile.id));
        setLikedByCount((c) => Math.max(0, c - 1));
        if (data.isMatch) {
          showToast(`${profile.first_name} ile eşleştiniz!`, 'success');
        } else {
          showToast('Beğenildi!', 'success');
        }
      } else if (res.status === 429) {
        showToast(data.error || 'Günlük hakkınız doldu.', 'error');
      } else {
        showToast(data.error || 'Bir hata oluştu', 'error');
      }
    } catch {
      showToast('Bağlantı hatası', 'error');
    }
  };

  const handleDismiss = (profileId: string) => {
    setLikedBy((prev) => prev.filter((p) => p.id !== profileId));
    setLikedByCount((c) => Math.max(0, c - 1));
  };

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center py-20 px-4">
        <div className="animate-spin w-10 h-10 border-4 border-violet-400 border-t-transparent rounded-full" />
        <p className="mt-4 text-[var(--matchup-text-muted)]">Yükleniyor...</p>
      </main>
    );
  }

  if (status !== 'authenticated' || !session) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center py-20 px-4">
        <div className="card max-w-md w-full text-center">
          <Link href="/" className="inline-block hover:opacity-90 transition-opacity mb-6">
            <Image src="/matchup_logo.png" alt="MatchUp" width={180} height={50} priority />
          </Link>
          <h1 className="text-xl font-bold mb-2">Seni Beğenenler</h1>
          <p className="text-[var(--matchup-text-muted)] mb-6">Bu sayfayı görmek için giriş yapın.</p>
          <Link href="/" className="btn-primary inline-flex items-center gap-2">
            <i className="fa-solid fa-right-to-bracket" /> Ana Sayfaya Dön
          </Link>
        </div>
      </main>
    );
  }

  if (!selectedCharacter) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center py-20 px-4">
        <div className="card max-w-md w-full text-center">
          <Link href="/" className="inline-block hover:opacity-90 transition-opacity mb-6">
            <Image src="/matchup_logo.png" alt="MatchUp" width={180} height={50} priority />
          </Link>
          <h1 className="text-xl font-bold mb-2">Karakter Seçilmedi</h1>
          <p className="text-[var(--matchup-text-muted)] mb-6">Önce ana sayfadan bir karakter seçmelisiniz.</p>
          <Link href="/" className="btn-primary inline-flex items-center gap-2">
            <i className="fa-solid fa-arrow-left" /> Ana Sayfaya Dön
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <Image src="/matchup_logo.png" alt="MatchUp" width={140} height={40} priority />
          </Link>
          <Link href="/" className="btn-secondary text-sm">
            <i className="fa-solid fa-arrow-left mr-2" /> Ana Sayfa
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <i className="fa-solid fa-eye text-violet-400" />
            Seni Beğenenler
          </h1>
          <p className="text-[var(--matchup-text-muted)] text-sm mt-1">Bu profiller seni beğendi. Beğenerek eşleş!</p>
        </div>

        {/* Pro değilse ve beğenen varsa */}
        {tier !== 'pro' && likedByCount > 0 ? (
          <div className="card text-center py-12">
            <i className="fa-solid fa-heart text-5xl text-[var(--matchup-primary)] mb-4" />
            <h3 className="text-lg font-bold mb-1">{likedByCount} kişi seni beğendi</h3>
            <p className="text-[var(--matchup-text-muted)] text-sm mb-4">Kim olduklarını görmek için MatchUp Pro&apos;ya geç.</p>
            <Link href="/" className="btn-primary inline-flex items-center gap-2">
              <i className="fa-solid fa-crown" /> Mağaza&apos;ya Git
            </Link>
          </div>
        ) : likedBy.length === 0 ? (
          <div className="card text-center py-12">
            <i className="fa-solid fa-heart-crack text-5xl text-[var(--matchup-text-muted)] mb-4" />
            <h3 className="text-lg font-bold mb-1">Henüz seni beğenen yok</h3>
            <p className="text-[var(--matchup-text-muted)] text-sm">Profilini güncelleyip daha fazla kişiye ulaş!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {likedBy.map((profile) => (
              <div key={profile.id} className="rounded-3xl overflow-hidden shadow-2xl bg-[var(--matchup-bg-card)] animate-fade-in">
                {/* Photo */}
                <div className="relative w-full aspect-[3/2] overflow-hidden">
                  {profile.photo_url ? (
                    <img src={profile.photo_url} alt="" className="w-full h-full object-cover object-top" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                      <i className="fa-solid fa-user text-4xl text-white/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    {/* Rozetler */}
                    {(() => {
                      const badges = getInlineBadges(profile);
                      return badges.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {badges.map(b => (
                            <span key={b.key} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${b.colorClass}`}>
                              <i className={`fa-solid ${b.icon}`} style={{ fontSize: '8px' }} /> {b.label}
                            </span>
                          ))}
                        </div>
                      ) : null;
                    })()}
                    <h3 className="text-xl font-bold text-white">{profile.first_name} {profile.last_name}</h3>
                    <p className="text-white/80 text-sm">{profile.age} · {getGenderLabel(profile.gender)}</p>
                    {profile.description && (
                      <p className="text-white/60 text-sm mt-1 line-clamp-2">{profile.description}</p>
                    )}
                  </div>
                </div>
                {/* Promptlar */}
                {profile.prompts && Object.keys(profile.prompts).filter(k => profile.prompts?.[k]?.trim()).length > 0 && (
                  <div className="px-4 pt-3 pb-2 space-y-2">
                    {PROFILE_PROMPTS.filter(p => profile.prompts?.[p.key]?.trim()).map(p => (
                      <div key={p.key}>
                        <p className="text-[var(--matchup-text-muted)] text-[10px] font-medium uppercase tracking-wide">{p.label}</p>
                        <p className="text-sm text-white/80 mt-0.5">{profile.prompts![p.key]}</p>
                      </div>
                    ))}
                  </div>
                )}
                {/* Actions */}
                <div className="p-4 flex gap-2">
                  <button
                    onClick={() => handleLike(profile)}
                    className="btn-primary py-2.5 flex-1 flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-heart" /> Beğen & Eşleş
                  </button>
                  <button
                    onClick={() => handleDismiss(profile.id)}
                    className="w-11 h-11 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all flex-shrink-0"
                  >
                    <i className="fa-solid fa-xmark text-lg" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </main>
  );
}
