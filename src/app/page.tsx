'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Application } from '@/lib/supabase';

interface Character {
  id: number;
  memberid: number;
  firstname: string;
  lastname: string;
}

interface Match {
  id: string;
  created_at: string;
  matchedWith: Application;
  myApplicationId: string;
}

const TEST_MODE_USER = {
  gtawId: 99999,
  username: 'TestUser',
  characters: [
    { id: 1001, memberid: 99999, firstname: 'John', lastname: 'Doe' },
    { id: 1002, memberid: 99999, firstname: 'Jane', lastname: 'Smith' },
    { id: 1003, memberid: 99999, firstname: 'Alex', lastname: 'Johnson' },
  ],
};

function formatResetAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const h = Math.floor(diff / (60 * 60 * 1000));
  const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  if (h > 0) return `${h}s ${m}dk sonra`;
  if (m > 0) return `${m}dk sonra`;
  return 'Yakında';
}

function formatTimeLeft(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff <= 0) return 'Süresi doldu';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days} gün ${hours} saat`;
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours} saat ${mins} dk`;
  return `${mins} dk`;
}

function getTierLabel(tier: string): string {
  if (tier === 'plus') return 'MatchUp+';
  if (tier === 'pro') return 'MatchUp Pro';
  return 'Ücretsiz';
}

function getTierColor(tier: string): string {
  if (tier === 'plus') return 'from-pink-500 to-orange-400';
  if (tier === 'pro') return 'from-violet-500 to-fuchsia-500';
  return '';
}

function HomeContent() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [possibleMatches, setPossibleMatches] = useState<Application[]>([]);
  const [hasApplication, setHasApplication] = useState(false);
  const [userApplication, setUserApplication] = useState<Application | null>(null);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isLoadingPossible, setIsLoadingPossible] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'discover' | 'matches'>('discover');
  const [showMatchModal, setShowMatchModal] = useState<Application | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [limits, setLimits] = useState<{ tier: string; dailyLimit: number; remaining: number; resetAt: string; boostExpiresAt: string | null; subscriptionExpiresAt?: string | null } | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState<string | null>(null);
  const [likedByCount, setLikedByCount] = useState<number | null>(null);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);

  const [testMode, setTestMode] = useState(false);
  const [testModeLoggedIn, setTestModeLoggedIn] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    age: '',
    weight: '',
    gender: '',
    sexualPreference: '',
    phone: '',
    facebrowser: '',
    description: '',
    photoUrl: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('matchup_test_mode');
    if (saved === 'true') setTestMode(true);
  }, []);

  const saveSelectedCharacter = useCallback((char: Character | null) => {
    if (char) localStorage.setItem('matchup_selected_character', JSON.stringify({ id: char.id, memberid: char.memberid, firstname: char.firstname, lastname: char.lastname }));
    else localStorage.removeItem('matchup_selected_character');
  }, []);

  const fetchLimits = useCallback(async () => {
    if (!selectedCharacter || testMode) return;
    try {
      const res = await fetch(`/api/me/limits?characterId=${selectedCharacter.id}`);
      if (res.ok) {
        const data = await res.json();
        setLimits(data);
      }
    } catch {
      // ignore
    }
  }, [selectedCharacter, testMode]);

  useEffect(() => {
    if (hasApplication && selectedCharacter && !showForm) fetchLimits();
  }, [hasApplication, selectedCharacter, showForm, fetchLimits]);

  useEffect(() => {
    if (!hasApplication || !selectedCharacter || showForm) return;
    fetch(`/api/liked-me?characterId=${selectedCharacter.id}`)
      .then((r) => r.ok ? r.json() : { count: 0 })
      .then((d) => setLikedByCount(d.count ?? 0))
      .catch(() => setLikedByCount(0));
  }, [hasApplication, selectedCharacter?.id, showForm]);

  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      showToast('Ödeme başarılı! Özellikleriniz aktif.', 'success');
      fetchLimits();
      window.history.replaceState({}, '', '/');
    } else if (payment === 'error') {
      showToast('Ödeme işlemi başarısız veya iptal edildi.', 'error');
      window.history.replaceState({}, '', '/');
    }
  }, [searchParams]);

  const effectiveSession =
    testMode && testModeLoggedIn
      ? { user: { ...TEST_MODE_USER, name: TEST_MODE_USER.username } }
      : session;
  const effectiveStatus = testMode ? (testModeLoggedIn ? 'authenticated' : 'unauthenticated') : status;

  useEffect(() => {
    if (effectiveStatus !== 'authenticated' || !effectiveSession?.user) return;
    const chars = testMode ? TEST_MODE_USER.characters : (effectiveSession.user as any).characters;
    if (!chars?.length || selectedCharacter) return;
    try {
      const raw = localStorage.getItem('matchup_selected_character');
      if (!raw) return;
      const saved = JSON.parse(raw) as { id: number; memberid: number; firstname: string; lastname: string };
      const found = (chars as Character[]).find((c) => c.id === saved.id);
      if (found) setSelectedCharacter(found);
    } catch {
      // ignore
    }
  }, [effectiveStatus, effectiveSession?.user, testMode, selectedCharacter]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchMyData = useCallback(async () => {
    if (!selectedCharacter) return;
    setIsLoadingMatches(true);
    try {
      if (testMode) {
        await new Promise((r) => setTimeout(r, 400));
        setMatches([]);
        setHasApplication(false);
        setUserApplication(null);
        setShowForm(true);
        setIsLoadingMatches(false);
        return;
      }
      const res = await fetch(`/api/my-matches?characterId=${selectedCharacter.id}`);
      const data = await res.json();
      setMatches(data.matches || []);
      setHasApplication(!!data.hasApplication);
      setUserApplication(data.application || null);
      setShowForm(!data.hasApplication);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMatches(false);
    }
  }, [selectedCharacter, testMode]);

  const fetchPossibleMatches = useCallback(async () => {
    if (!selectedCharacter) return;
    setIsLoadingPossible(true);
    try {
      if (testMode) {
        await new Promise((r) => setTimeout(r, 400));
        setPossibleMatches([]);
        setIsLoadingPossible(false);
        return;
      }
      const res = await fetch(`/api/possible-matches?characterId=${selectedCharacter.id}&limit=20`);
      const data = await res.json();
      setPossibleMatches(data.possibleMatches || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingPossible(false);
    }
  }, [selectedCharacter, testMode]);

  useEffect(() => {
    const gtawId = testMode ? TEST_MODE_USER.gtawId : session?.user?.gtawId;
    if (selectedCharacter && gtawId) fetchMyData();
  }, [selectedCharacter, session?.user?.gtawId, testMode, fetchMyData]);

  useEffect(() => {
    if (hasApplication && activeTab === 'discover' && !showForm) fetchPossibleMatches();
  }, [hasApplication, activeTab, showForm, fetchPossibleMatches]);

  // Eşleşmeler sekmesine geçince listeyi anlık güncelle
  useEffect(() => {
    if (hasApplication && activeTab === 'matches' && selectedCharacter && !testMode) {
      fetch(`/api/my-matches?characterId=${selectedCharacter.id}`)
        .then((res) => res.json())
        .then((data) => setMatches(data.matches || []))
        .catch(() => {});
    }
  }, [activeTab, hasApplication, selectedCharacter?.id, testMode]);

  const handleLike = async (profile: Application) => {
    if (!selectedCharacter || testMode) return;
    setActionPending(profile.id);
    try {
      const res = await fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toApplicationId: profile.id, characterId: selectedCharacter.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setPossibleMatches((prev) => prev.filter((p) => p.id !== profile.id));
        if (data.remaining !== undefined && limits) setLimits((l) => l ? { ...l, remaining: data.remaining, resetAt: data.resetAt || l.resetAt } : null);
        if (data.isMatch) {
          setShowMatchModal(profile);
          fetchMyData();
        }
      } else {
        if (res.status === 429) showToast(data.error || 'Günlük hakkınız doldu.', 'error');
        else showToast(data.error || 'Bir hata oluştu', 'error');
        if (data.resetAt && limits) setLimits((l) => l ? { ...l, remaining: 0, resetAt: data.resetAt } : null);
      }
    } catch {
      showToast('Bağlantı hatası', 'error');
    } finally {
      setActionPending(null);
    }
  };

  const handleDislike = async (profile: Application) => {
    if (!selectedCharacter || testMode) return;
    setActionPending(profile.id);
    try {
      const res = await fetch('/api/dislike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toApplicationId: profile.id, characterId: selectedCharacter.id }),
      });
      const data = res.ok ? await res.json() : {};
      setPossibleMatches((prev) => prev.filter((p) => p.id !== profile.id));
      if (data.remaining !== undefined && limits) setLimits((l) => l ? { ...l, remaining: data.remaining, resetAt: data.resetAt || l.resetAt } : null);
      if (!res.ok && res.status === 429) showToast('Günlük hakkınız doldu.', 'error');
    } catch {
      showToast('Bağlantı hatası', 'error');
    } finally {
      setActionPending(null);
    }
  };

  const startEditing = () => {
    if (!userApplication) return;
    setFormData({
      firstName: userApplication.first_name,
      lastName: userApplication.last_name,
      age: String(userApplication.age),
      weight: String(userApplication.weight ?? ''),
      gender: userApplication.gender,
      sexualPreference: userApplication.sexual_preference,
      phone: userApplication.phone ?? '',
      facebrowser: userApplication.facebrowser,
      description: userApplication.description,
      photoUrl: userApplication.photo_url,
    });
    setShowForm(true);
  };

  const rejectMatch = async (matchId: string, myApplicationId: string, matchedApplicationId: string) => {
    if (!confirm('Bu eşleşmeyi kaldırmak istediğinize emin misiniz?')) return;
    setRejectingId(matchId);
    try {
      const res = await fetch('/api/reject-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, myApplicationId, matchedApplicationId }),
      });
      if (res.ok) {
        setMatches((prev) => prev.filter((m) => m.id !== matchId));
        showToast('Eşleşme kaldırıldı.', 'success');
      } else {
        showToast('Bir hata oluştu.', 'error');
      }
    } catch {
      showToast('Bağlantı hatası', 'error');
    } finally {
      setRejectingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharacter) {
      showToast('Lütfen bir karakter seçin!', 'error');
      return;
    }
    if (!formData.photoUrl?.trim()) {
      showToast('Lütfen bir fotoğraf linki girin!', 'error');
      return;
    }
    if (!formData.age?.trim() || !formData.gender || !formData.sexualPreference || !formData.facebrowser?.trim() || !formData.description?.trim()) {
      showToast('Lütfen zorunlu alanları doldurun (telefon isteğe bağlıdır).', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      if (testMode) {
        await new Promise((r) => setTimeout(r, 800));
        showToast('(TEST) Profil kaydedildi!', 'success');
        setHasApplication(true);
        setShowForm(false);
        setIsSubmitting(false);
        return;
      }
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          firstName: selectedCharacter.firstname,
          lastName: selectedCharacter.lastname,
          characterId: selectedCharacter.id,
          characterName: `${selectedCharacter.firstname} ${selectedCharacter.lastname}`,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        showToast(hasApplication ? 'Profil güncellendi!' : 'Profil oluşturuldu!', 'success');
        fetchMyData();
      } else {
        showToast(result.error || 'Bir hata oluştu!', 'error');
      }
    } catch {
      showToast('Bağlantı hatası.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!userApplication?.id || !selectedCharacter) return;
    if (!confirm('Profilinizi kalıcı olarak silmek istediğinize emin misiniz? Eşleşmeler ve üyelik bilgisi de kaldırılacaktır.')) return;
    setIsDeletingProfile(true);
    try {
      const res = await fetch('/api/me/delete-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: userApplication.id }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Profiliniz silindi.', 'success');
        setHasApplication(false);
        setUserApplication(null);
        setShowForm(false);
        setMatches((prev) => prev.filter((m) => m.myApplicationId !== userApplication.id));
        setLimits(null);
      } else {
        showToast(data.error || 'Profil silinirken hata oluştu.', 'error');
      }
    } catch {
      showToast('Bağlantı hatası.', 'error');
    } finally {
      setIsDeletingProfile(false);
    }
  };

  const handleCheckout = async (product: 'plus' | 'pro' | 'boost') => {
    if (!selectedCharacter) return;
    setCheckoutPending(product);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, characterId: selectedCharacter.id }),
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

  const getGenderLabel = (v: string) => ({ erkek: 'Erkek', kadin: 'Kadın' }[v] || v);
  const getPreferenceLabel = (v: string) =>
    ({ heteroseksuel: 'Heteroseksüel', homoseksuel: 'Homoseksüel', biseksuel: 'Biseksüel' }[v] || v);

  if (effectiveStatus === 'loading') {
    return (
      <main className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-[var(--matchup-primary)] border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-[var(--matchup-text-muted)]">Yükleniyor...</p>
        </div>
      </main>
    );
  }

  if (!effectiveSession) {
    return (
      <main className="flex items-center justify-center px-4 py-20">
        <div className="card max-w-md w-full text-center animate-fade-in">
          <Link href="/" className="inline-block hover:opacity-90 transition-opacity">
            <Image src="/matchup_logo.png" alt="MatchUp" width={220} height={60} className="mx-auto mb-6" priority />
          </Link>
          <p className="text-[var(--matchup-text-muted)] text-lg mb-8">
            <i className="fa-solid fa-heart text-[var(--matchup-primary)] mr-2" />
            Hayatının aşkını bulmaya bir adım kaldı!
          </p>
          {testMode ? (
            <button onClick={() => setTestModeLoggedIn(true)} className="btn-primary flex items-center justify-center gap-3">
              <i className="fa-solid fa-flask" /> Test Kullanıcısı Olarak Giriş Yap
            </button>
          ) : (
            <button onClick={() => signIn('gtaw')} className="btn-primary flex items-center justify-center gap-3">
              <i className="fa-solid fa-right-to-bracket" /> GTA World ile Giriş Yap
            </button>
          )}
          <p className="text-[var(--matchup-text-muted)] text-sm mt-6">Giriş yaparak gizlilik politikamızı kabul etmiş olursunuz.</p>
          {testMode && (
            <div className="mt-6 p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/50">
              <p className="text-yellow-400 text-sm"><i className="fa-solid fa-flask mr-2" /> Test Modu Aktif</p>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (!selectedCharacter) {
    const characters = testMode ? TEST_MODE_USER.characters : (effectiveSession.user as any).characters || [];
    return (
      <main className="py-12 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-8 animate-fade-in">
            <Link href="/" className="hover:opacity-90 transition-opacity">
              <Image src="/matchup_logo.png" alt="MatchUp" width={140} height={40} priority />
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-[var(--matchup-text-muted)] text-sm">
                {testMode ? TEST_MODE_USER.username : (effectiveSession.user as any).username}
                {testMode && <span className="text-yellow-400 ml-1">(TEST)</span>}
              </span>
              <button onClick={() => (testMode ? (setTestModeLoggedIn(false), setSelectedCharacter(null)) : signOut())} className="btn-secondary text-sm">
                Çıkış
              </button>
            </div>
          </div>
          <div className="card animate-fade-in">
            <h2 className="text-2xl font-bold text-center mb-2">Karakter Seç</h2>
            <p className="text-[var(--matchup-text-muted)] text-center mb-6">Hangi karakteriniz için profil oluşturacaksınız?</p>
            {characters.length === 0 ? (
              <p className="text-center text-[var(--matchup-text-muted)]">Hesabınızda karakter bulunamadı.</p>
            ) : (
              <div className="space-y-3">
                {characters.map((char: Character) => (
                  <button
                    key={char.id}
                    onClick={() => { setSelectedCharacter(char); saveSelectedCharacter(char); }}
                    className="w-full p-4 rounded-xl bg-[var(--matchup-bg-input)] hover:bg-[var(--matchup-primary)] hover:text-white transition-all text-left flex items-center justify-between group"
                  >
                    <span className="font-semibold">{char.firstname} {char.lastname}</span>
                    <i className="fa-solid fa-arrow-right opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </div>
          {testMode && (
            <div className="mt-6 p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/50 text-center">
              <p className="text-yellow-400 text-sm"><i className="fa-solid fa-flask mr-2" /> Test Modu</p>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (showForm) {
    return (
      <main className="py-12 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm" disabled={!hasApplication}>
              <i className="fa-solid fa-arrow-left mr-1" /> Geri
            </button>
            <span className="text-[var(--matchup-text-muted)] text-sm">
              {selectedCharacter.firstname} {selectedCharacter.lastname}
            </span>
          </div>
          <div className="card animate-fade-in">
            <h2 className="text-2xl font-bold mb-6">{hasApplication ? 'Profili Düzenle' : 'Profil Oluştur'}</h2>
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div>
                <label className="form-label">Fotoğraf Linki</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://..."
                  value={formData.photoUrl}
                  onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                  required
                />
                {formData.photoUrl && (
                  <div className="mt-3 flex justify-center">
                    <img src={formData.photoUrl} alt="Önizleme" className="w-32 h-32 object-cover rounded-xl border-2 border-[var(--matchup-primary)]" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Yaş</label>
                  <input type="number" className="form-input" placeholder="25" min={18} max={99} value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Kilo (kg)</label>
                  <input type="number" className="form-input" placeholder="75" min={40} max={200} value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Cinsiyet</label>
                  <select className="form-input" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} required>
                    <option value="">Seçiniz</option>
                    <option value="erkek">Erkek</option>
                    <option value="kadin">Kadın</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Yönelim</label>
                  <select className="form-input" value={formData.sexualPreference} onChange={(e) => setFormData({ ...formData, sexualPreference: e.target.value })} required>
                    <option value="">Seçiniz</option>
                    <option value="heteroseksuel">Heteroseksüel</option>
                    <option value="homoseksuel">Homoseksüel</option>
                    <option value="biseksuel">Biseksüel</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Telefon <span className="text-[var(--matchup-text-muted)] font-normal">(isteğe bağlı)</span></label>
                  <input type="tel" className="form-input" placeholder="555-1234" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Facebrowser</label>
                  <input type="text" className="form-input" placeholder="@kullaniciadi" value={formData.facebrowser} onChange={(e) => setFormData({ ...formData, facebrowser: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="form-label">Kendini Tanıt</label>
                <textarea className="form-input min-h-[120px] resize-none" placeholder="Kendinden bahset..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required />
              </div>
              <button type="submit" className="btn-primary mt-8" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    Gönderiliyor...
                  </span>
                ) : (
                  <><i className="fa-solid fa-heart-circle-check mr-2" />{hasApplication ? 'Güncelle' : 'Profil Oluştur'}</>
                )}
              </button>
              {hasApplication && (
                <div className="mt-6 pt-6 border-t border-[var(--matchup-border)]">
                  <button
                    type="button"
                    onClick={handleDeleteProfile}
                    disabled={isDeletingProfile}
                    className="w-full py-2.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-sm font-medium disabled:opacity-50"
                  >
                    {isDeletingProfile ? 'Siliniyor...' : <><i className="fa-solid fa-trash mr-2" />Profili Sil</>}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
        {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
      </main>
    );
  }

  const currentCard = possibleMatches[0];

  return (
    <main className="py-6 px-4 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="animate-fade-in mb-6">
          {/* Row 1: Logo + Karakter + Çıkış */}
          <div className="flex items-center justify-between mb-3">
            <Link href="/" className="hover:opacity-90 transition-opacity">
              <Image src="/matchup_logo.png" alt="MatchUp" width={120} height={34} priority />
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-[var(--matchup-text-muted)] text-sm">
                <i className="fa-solid fa-user mr-1.5 text-xs" />
                {selectedCharacter.firstname} {selectedCharacter.lastname}
              </span>
              <button onClick={() => { setSelectedCharacter(null); saveSelectedCharacter(null); }} className="text-[var(--matchup-text-muted)] hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/5 transition-all">
                <i className="fa-solid fa-repeat mr-1" /> Değiştir
              </button>
            </div>
          </div>

          {/* Row 2: Üyelik + Limitler — tek satır, taşma yok */}
          {limits && (
            <div className="flex items-center gap-2 mb-3 overflow-x-auto scrollbar-hide">
              {/* Üyelik Badge */}
              {limits.tier !== 'free' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${limits.tier === 'pro' ? 'rgba(139,92,246,0.15)' : 'rgba(236,72,153,0.15)'}, ${limits.tier === 'pro' ? 'rgba(217,70,239,0.15)' : 'rgba(249,115,22,0.15)'})`, border: `1px solid ${limits.tier === 'pro' ? 'rgba(139,92,246,0.3)' : 'rgba(236,72,153,0.3)'}` }}
                >
                  <i className={`fa-solid ${limits.tier === 'pro' ? 'fa-crown' : 'fa-star'} ${limits.tier === 'pro' ? 'text-violet-400' : 'text-pink-400'}`} style={{ fontSize: '10px' }} />
                  <span>{getTierLabel(limits.tier)}</span>
                  {limits.subscriptionExpiresAt && (
                    <span className="opacity-70">· {formatTimeLeft(limits.subscriptionExpiresAt)}</span>
                  )}
                </div>
              )}

              {/* Like Counter */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--matchup-bg-input)] border border-[var(--matchup-border)] text-xs whitespace-nowrap flex-shrink-0">
                <i className="fa-solid fa-heart text-[var(--matchup-primary)]" style={{ fontSize: '10px' }} />
                <span className="font-medium">{limits.remaining === 999999 ? '∞' : limits.remaining}/{limits.dailyLimit === 999999 ? '∞' : limits.dailyLimit}</span>
                <span className="text-[var(--matchup-text-muted)]">· {formatResetAt(limits.resetAt)}</span>
              </div>

              {/* Boost */}
              {limits.boostExpiresAt && new Date(limits.boostExpiresAt) > new Date() && (
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap flex-shrink-0" style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)' }}>
                  <i className="fa-solid fa-bolt text-yellow-400" style={{ fontSize: '10px' }} />
                  <span className="font-medium text-yellow-400">Boost · {formatTimeLeft(limits.boostExpiresAt)}</span>
                </div>
              )}
            </div>
          )}

          {/* Row 3: Action Buttons */}
          <div className="flex items-center gap-2">
            <Link href="/begeniler" className="btn-secondary text-sm flex-1 whitespace-nowrap text-center">
              <i className="fa-solid fa-eye mr-1.5" /> Beğenenler{likedByCount != null && likedByCount > 0 ? ` (${likedByCount})` : ''}
            </Link>
            <button onClick={() => setShowShop(true)} className="btn-secondary text-sm flex-1 whitespace-nowrap">
              <i className="fa-solid fa-store mr-1.5" /> Mağaza
            </button>
            <button onClick={startEditing} className="btn-secondary text-sm flex-1 whitespace-nowrap">
              <i className="fa-solid fa-user-pen mr-1.5" /> Profil
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-[var(--matchup-bg-input)] p-1 mb-6">
          <button
            onClick={() => setActiveTab('discover')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'discover' ? 'bg-[var(--matchup-primary)] text-white' : 'text-[var(--matchup-text-muted)]'}`}
          >
            <i className="fa-solid fa-compass mr-2" /> Keşfet
          </button>
          <button
            onClick={() => setActiveTab('matches')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'matches' ? 'bg-[var(--matchup-primary)] text-white' : 'text-[var(--matchup-text-muted)]'}`}
          >
            <i className="fa-solid fa-heart mr-2" /> Eşleşmeler {matches.length > 0 && <span className="ml-1">({matches.length})</span>}
          </button>
        </div>

        {activeTab === 'discover' && (
          <div className="min-h-[500px] flex flex-col items-center justify-center">
            {isLoadingPossible ? (
              <div className="text-center py-12">
                <div className="animate-spin w-10 h-10 border-4 border-[var(--matchup-primary)] border-t-transparent rounded-full mx-auto" />
                <p className="mt-4 text-[var(--matchup-text-muted)]">Profil getiriliyor...</p>
              </div>
            ) : !currentCard ? (
              <div className="card text-center py-12">
                <i className="fa-solid fa-users text-5xl text-[var(--matchup-text-muted)] mb-4" />
                <h3 className="text-xl font-bold mb-2">Şimdilik bu kadar</h3>
                <p className="text-[var(--matchup-text-muted)] text-sm mb-4">Yeni profiller eklendikçe burada görünecek. Daha sonra tekrar bak!</p>
                <button onClick={fetchPossibleMatches} className="btn-secondary">Yenile</button>
              </div>
            ) : (
              <>
                <div className="w-full animate-fade-in rounded-3xl overflow-hidden shadow-2xl">
                  <div className="relative w-full aspect-[4/5] overflow-hidden">
                    {currentCard.photo_url ? (
                      <img src={currentCard.photo_url} alt="" className="w-full h-full object-cover object-top" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[var(--matchup-primary)] to-purple-600 flex items-center justify-center">
                        <i className="fa-solid fa-user text-6xl text-white/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 pt-20 pb-5 px-5">
                      <h3 className="text-2xl font-bold text-white drop-shadow-lg">
                        {currentCard.first_name} {currentCard.last_name}
                      </h3>
                      <p className="text-white/80 text-sm mt-0.5">
                        {currentCard.age} · {getGenderLabel(currentCard.gender)}
                      </p>
                      {currentCard.description && (
                        <p className="text-white/60 text-sm mt-2 line-clamp-3">{currentCard.description}</p>
                      )}
                    </div>
                  </div>
                </div>
                {limits?.remaining === 0 && (
                  <p className="text-center text-[var(--matchup-text-muted)] text-sm mt-4">Günlük hakkınız doldu. 24 saat sonra yenilenecek veya Mağaza'dan daha fazla hak alabilirsiniz.</p>
                )}
                <div className="flex items-center justify-center gap-8 mt-8">
                  <button
                      onClick={() => handleDislike(currentCard)}
                      disabled={!!actionPending || (limits !== null && limits.remaining === 0)}
                      className="w-18 h-18 rounded-full border-2 border-red-500/50 text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all disabled:opacity-50"
                    >
                      <i className="fa-solid fa-xmark text-2xl" />
                    </button>
                    <button
                      onClick={() => handleLike(currentCard)}
                      disabled={!!actionPending || (limits !== null && limits.remaining === 0)}
                      className="w-18 h-18 rounded-full bg-[var(--matchup-primary)] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all disabled:opacity-50"
                    >
                      <i className="fa-solid fa-heart text-2xl" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'matches' && (
          <div className="space-y-4">
            {isLoadingMatches ? (
              <div className="text-center py-12">
                <div className="animate-spin w-10 h-10 border-4 border-[var(--matchup-primary)] border-t-transparent rounded-full mx-auto" />
              </div>
            ) : matches.length === 0 ? (
              <div className="card text-center py-10">
                <i className="fa-solid fa-heart-crack text-5xl text-[var(--matchup-text-muted)] mb-3" />
                <h3 className="text-lg font-bold mb-1">Henüz eşleşme yok</h3>
                <p className="text-[var(--matchup-text-muted)] text-sm">Beğendiğin profiller seni de beğenirse burada görünecek.</p>
              </div>
            ) : (
              matches.map((match) => (
                <div key={match.id} className="rounded-3xl overflow-hidden shadow-2xl bg-[var(--matchup-bg-card)] animate-fade-in">
                  <div className="relative w-full aspect-[4/5] overflow-hidden">
                    {match.matchedWith.photo_url ? (
                      <img src={match.matchedWith.photo_url} alt="" className="w-full h-full object-cover object-top" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[var(--matchup-primary)] to-purple-600 flex items-center justify-center">
                        <i className="fa-solid fa-user text-4xl text-white/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 pt-12 pb-3 px-4">
                      <h3 className="text-xl font-bold text-white drop-shadow-lg">{match.matchedWith.first_name} {match.matchedWith.last_name}</h3>
                      <p className="text-white/90 text-xs">{match.matchedWith.age} · {getGenderLabel(match.matchedWith.gender)} · {getPreferenceLabel(match.matchedWith.sexual_preference)}</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {match.matchedWith.phone ? (
                        <a href={`tel:${match.matchedWith.phone}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--matchup-bg-input)] text-sm">
                          <i className="fa-solid fa-phone text-[var(--matchup-primary)]" /> {match.matchedWith.phone}
                        </a>
                      ) : (
                        <span className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--matchup-bg-input)] text-sm text-[var(--matchup-text-muted)]">
                          <i className="fa-solid fa-phone text-[var(--matchup-text-muted)]" /> Belirtilmedi
                        </span>
                      )}
                      <a href={`https://facebrowser-tr.gta.world/${(match.matchedWith.facebrowser || '').replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--matchup-bg-input)] text-sm truncate max-w-[140px]">
                        <i className="fa-solid fa-at text-[var(--matchup-primary)]" /> {match.matchedWith.facebrowser}
                      </a>
                    </div>
                    <p className="text-sm text-[var(--matchup-text-muted)] line-clamp-2">{match.matchedWith.description}</p>
                    <button
                      onClick={() => rejectMatch(match.id, match.myApplicationId, match.matchedWith.id)}
                      disabled={rejectingId === match.id}
                      className="w-full py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm"
                    >
                      {rejectingId === match.id ? 'Kaldırılıyor...' : 'Eşleşmeyi Kaldır'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={() => setShowMatchModal(null)}>
          <div className="card max-w-sm w-full text-center animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-2xl font-bold text-[var(--matchup-primary)] mb-1">Eşleşme!</h2>
            <p className="text-[var(--matchup-text-muted)] mb-4">{showMatchModal.first_name} {showMatchModal.last_name} seni de beğendi.</p>
            <button onClick={() => setShowMatchModal(null)} className="btn-primary">Harika!</button>
          </div>
        </div>
      )}

      {showShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in overflow-y-auto" onClick={() => setShowShop(false)}>
          <div className="card max-w-md w-full my-8 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Mağaza</h2>
              <button onClick={() => setShowShop(false)} className="text-[var(--matchup-text-muted)] hover:text-white text-2xl">&times;</button>
            </div>
            <p className="text-[var(--matchup-text-muted)] text-sm mb-6">Özellikler ve fiyatlar aşağıda. Ödeme GTA World banka ağ geçidi ile güvenli şekilde yapılır.</p>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--matchup-bg-input)] border border-[var(--matchup-border)]">
                <h3 className="font-bold text-[var(--matchup-primary)] mb-1">MatchUp+</h3>
                <p className="text-sm text-[var(--matchup-text-muted)] mb-2">1 haftalık. Günlük 20 like/dislike hakkı (normal 10). 24 saatte bir yenilenir.</p>
                <p className="text-lg font-bold mb-2">5.000$</p>
                <button onClick={() => handleCheckout('plus')} disabled={!!checkoutPending} className="btn-primary text-sm py-2">Satın Al</button>
              </div>
              <div className="p-4 rounded-xl bg-[var(--matchup-bg-input)] border border-[var(--matchup-primary)]/50">
                <h3 className="font-bold text-[var(--matchup-primary)] mb-1">MatchUp Pro</h3>
                <p className="text-sm text-[var(--matchup-text-muted)] mb-2">1 haftalık. Sınırsız like/dislike. Seni beğenenleri görebilirsin.</p>
                <p className="text-lg font-bold mb-1">İlk alımlara özel 16.500$</p>
                <p className="text-xs text-[var(--matchup-text-muted)] mb-2">(Normal 20.000$)</p>
                <button onClick={() => handleCheckout('pro')} disabled={!!checkoutPending} className="btn-primary text-sm py-2">Satın Al</button>
              </div>
              <div className="p-4 rounded-xl bg-[var(--matchup-bg-input)] border border-[var(--matchup-border)]">
                <h3 className="font-bold text-[var(--matchup-primary)] mb-1">Beni Öne Çıkart</h3>
                <p className="text-sm text-[var(--matchup-text-muted)] mb-2">24 saat boyunca uyumlu herkeste ilk 10'da görünürsün.</p>
                <p className="text-lg font-bold mb-2">5.000$</p>
                <button onClick={() => handleCheckout('boost')} disabled={!!checkoutPending} className="btn-primary text-sm py-2">Satın Al</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<main className="flex items-center justify-center py-20"><div className="animate-spin w-10 h-10 border-4 border-[var(--matchup-primary)] border-t-transparent rounded-full mx-auto" /></main>}>
      <HomeContent />
    </Suspense>
  );
}
