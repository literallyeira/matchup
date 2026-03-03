'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';

interface Character {
  id: number;
  memberid: number;
  firstname: string;
  lastname: string;
}

const PRODUCTS = [
  { id: 'plus' as const, name: 'MatchUp+', price: 5000, desc: '1 haftalık. Günlük 20 like/dislike hakkı (normal 10). 24 saatte bir yenilenir.' },
  { id: 'pro' as const, name: 'MatchUp Pro', price: 15000, desc: '1 haftalık. Sınırsız like/dislike. Seni beğenenleri görebilirsin.' },
  { id: 'boost' as const, name: 'Beni Öne Çıkart', price: 5000, desc: '24 saat boyunca uyumlu herkeste ilk 10\'da görünürsün.' },
];

export default function MagazaPage() {
  const { data: session, status } = useSession();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [checkoutPending, setCheckoutPending] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [showReferralModal, setShowReferralModal] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    const chars = (session.user as any).characters || [];
    setCharacters(chars);
    if (chars.length > 0 && !selectedCharacter) {
      let next: Character | null = null;
      try {
        const raw = localStorage.getItem('matchup_selected_character');
        if (raw) {
          const saved = JSON.parse(raw) as { id: number; memberid: number; firstname: string; lastname: string };
          const found = chars.find((c: Character) => c.id === saved.id);
          if (found) next = found;
        }
        if (!next) next = chars[0];
      } catch {
        next = chars[0];
      }
      if (next) setSelectedCharacter(next);
    }
  }, [status, session?.user]);

  const saveCharacter = useCallback((char: Character | null) => {
    if (char) localStorage.setItem('matchup_selected_character', JSON.stringify({ id: char.id, memberid: char.memberid, firstname: char.firstname, lastname: char.lastname }));
  }, []);

  const handleCheckout = async (product: 'plus' | 'pro' | 'boost') => {
    if (!selectedCharacter) return;
    setCheckoutPending(product);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product,
          characterId: selectedCharacter.id,
          ...(discountCode.trim() && { discountCode: discountCode.trim() }),
        }),
      });
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      showToast(data.error || 'Ödeme başlatılamadı', 'error');
    } catch {
      showToast('Bağlantı hatası', 'error');
    } finally {
      setCheckoutPending(null);
    }
  };

  const openReferralModal = async () => {
    setShowReferralModal(true);
    try {
      const r = await fetch('/api/me/referral-code');
      const d = await r.json();
      if (r.ok) {
        if (d.inviteLink) setInviteLink(d.inviteLink);
        setReferralCount(typeof d.referralCount === 'number' ? d.referralCount : 0);
      }
    } catch { /* ignore */ }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--matchup-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white px-4">
        <Link href="/" className="mb-6">
          <Image src="/matchup_logo.png" alt="MatchUp" width={200} height={55} priority />
        </Link>
        <p className="text-[var(--matchup-text-muted)] mb-6">Üyelik ve paketler için giriş yapın.</p>
        <button onClick={() => signIn('gtaw')} className="btn-primary">
          <i className="fa-solid fa-right-to-bracket mr-2" /> GTA World ile Giriş Yap
        </button>
        <Link href="/" className="mt-6 text-[var(--matchup-text-muted)] hover:text-white text-sm">Ana sayfaya dön</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-xl text-sm font-medium ${toast.type === 'success' ? 'bg-green-500/90' : 'bg-red-500/90'}`}>
          {toast.message}
        </div>
      )}

      <header className="border-b border-white/10 sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="hover:opacity-90">
            <Image src="/matchup_logo.png" alt="MatchUp" width={140} height={40} />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-secondary text-sm">Ana Sayfa</Link>
            <span className="text-[var(--matchup-text-muted)] text-sm hidden sm:inline">{session?.user && (session.user as any).username}</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Mağaza</h1>
        <p className="text-[var(--matchup-text-muted)] text-sm mb-6">Ödeme GTA World banka ağ geçidi ile güvenli şekilde yapılır.</p>

        {characters.length > 1 && (
          <div className="mb-6 p-4 rounded-xl bg-[var(--matchup-bg-card)] border border-[var(--matchup-border)]">
            <label className="block text-sm font-medium text-[var(--matchup-text-muted)] mb-2">Satın alma yapılacak karakter</label>
            <div className="flex flex-wrap gap-2">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => { setSelectedCharacter(char); saveCharacter(char); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedCharacter?.id === char.id ? 'bg-[var(--matchup-primary)] text-white' : 'bg-[var(--matchup-bg-input)] hover:bg-white/10'}`}
                >
                  {char.firstname} {char.lastname}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6 p-4 rounded-xl bg-[var(--matchup-bg-input)] border border-[var(--matchup-border)]">
          <label className="block text-sm font-medium text-[var(--matchup-text-muted)] mb-2">İndirim kodu (opsiyonel)</label>
          <input
            type="text"
            value={discountCode}
            onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
            placeholder="Kodunuz varsa girin"
            className="form-input w-full max-w-xs"
          />
          <p className="text-xs text-[var(--matchup-text-muted)] mt-1">Bir kodu her kullanıcı yalnızca bir kez kullanabilir.</p>
        </div>

        <div className="space-y-4">
          {PRODUCTS.map((prod) => (
            <div key={prod.id} className="p-4 rounded-xl bg-[var(--matchup-bg-card)] border border-[var(--matchup-border)]">
              <h2 className="font-bold text-[var(--matchup-primary)] mb-1">{prod.name}</h2>
              <p className="text-sm text-[var(--matchup-text-muted)] mb-2">{prod.desc}</p>
              <p className="text-lg font-bold mb-3">{prod.price.toLocaleString('tr-TR')}$</p>
              <button
                onClick={() => handleCheckout(prod.id)}
                disabled={!!checkoutPending || !selectedCharacter}
                className="btn-primary text-sm py-2"
              >
                {checkoutPending === prod.id ? 'Yönlendiriliyor...' : 'Satın Al'}
              </button>
            </div>
          ))}

          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
            <h2 className="font-bold text-emerald-400 mb-1"><i className="fa-solid fa-gift mr-2" />Ücretsiz Pro</h2>
            <p className="text-sm text-[var(--matchup-text-muted)] mb-2">20 yeni karakteri davet et, 1 ay MatchUp Pro kazan! Sadece application'ı (profili) olmayan karakterler sayılır.</p>
            <button onClick={openReferralModal} className="btn-secondary text-sm py-2 w-full">
              <i className="fa-solid fa-user-plus mr-2" />Davet Linkimi Al
            </button>
          </div>
        </div>
      </main>

      {showReferralModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={() => setShowReferralModal(false)}>
          <div className="card max-w-sm w-full animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold"><i className="fa-solid fa-user-plus mr-2 text-[var(--matchup-primary)]" />Davet Et, Pro Kazan</h2>
              <button onClick={() => setShowReferralModal(false)} className="text-[var(--matchup-text-muted)] hover:text-white text-2xl">&times;</button>
            </div>
            {referralCount != null && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm font-medium text-emerald-400">
                  <i className="fa-solid fa-users mr-2" />
                  {referralCount}/20 davet tamamlandı
                  {referralCount >= 20 && <span className="ml-1">— Pro kazandın!</span>}
                </p>
              </div>
            )}
            <p className="text-sm text-[var(--matchup-text-muted)] mb-4">20 yeni karakteri bu linkle davet eden 1 ay MatchUp Pro kazanır.</p>
            {inviteLink ? (
              <div className="flex gap-2">
                <input readOnly value={inviteLink} className="flex-1 px-3 py-2 rounded-lg bg-[var(--matchup-bg-input)] border border-[var(--matchup-border)] text-sm truncate" />
                <button
                  onClick={() => { navigator.clipboard?.writeText(inviteLink); showToast('Link kopyalandı!', 'success'); }}
                  className="btn-primary text-sm py-2 px-4 whitespace-nowrap"
                >
                  <i className="fa-solid fa-copy mr-2" />Kopyala
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="animate-spin w-8 h-8 border-2 border-[var(--matchup-primary)] border-t-transparent rounded-full mx-auto" />
                <p className="mt-2 text-sm text-[var(--matchup-text-muted)]">Link hazırlanıyor...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
