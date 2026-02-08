'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
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

export default function Home() {
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

  const effectiveSession =
    testMode && testModeLoggedIn
      ? { user: { ...TEST_MODE_USER, name: TEST_MODE_USER.username } }
      : session;
  const effectiveStatus = testMode ? (testModeLoggedIn ? 'authenticated' : 'unauthenticated') : status;

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
        if (data.isMatch) {
          setShowMatchModal(profile);
          fetchMyData();
        }
      } else {
        showToast(data.error || 'Bir hata oluştu', 'error');
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
      await fetch('/api/dislike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toApplicationId: profile.id, characterId: selectedCharacter.id }),
      });
      setPossibleMatches((prev) => prev.filter((p) => p.id !== profile.id));
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
      phone: userApplication.phone,
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
    if (!formData.photoUrl) {
      showToast('Lütfen bir fotoğraf linki girin!', 'error');
      return;
    }
    if (!selectedCharacter) {
      showToast('Lütfen bir karakter seçin!', 'error');
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
            <Image src="/matchup_logo.png" alt="MatchUp" width={140} height={40} priority />
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
                    onClick={() => setSelectedCharacter(char)}
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
            <form onSubmit={handleSubmit} className="space-y-6">
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
                  <label className="form-label">Telefon</label>
                  <input type="tel" className="form-input" placeholder="555-1234" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
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
            </form>
          </div>
        </div>
        {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
      </main>
    );
  }

  const currentCard = possibleMatches[0];

  return (
    <main className="py-8 px-4 pb-24">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6 animate-fade-in">
          <Image src="/matchup_logo.png" alt="MatchUp" width={120} height={34} priority />
          <div className="flex items-center gap-2">
            <button onClick={startEditing} className="btn-secondary text-sm">
              <i className="fa-solid fa-user-pen mr-1" /> Profil
            </button>
            <button onClick={() => setSelectedCharacter(null)} className="btn-secondary text-sm">Değiştir</button>
          </div>
        </div>

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
          <div className="min-h-[420px] flex flex-col items-center justify-center">
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
                <div className="card p-0 overflow-hidden w-full animate-fade-in" style={{ minHeight: 380 }}>
                  <div className="relative h-72 w-full">
                    {currentCard.photo_url ? (
                      <img src={currentCard.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[var(--matchup-primary)] to-purple-600 flex items-center justify-center">
                        <i className="fa-solid fa-user text-6xl text-white/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-2xl font-bold text-white drop-shadow-lg">
                        {currentCard.first_name} {currentCard.last_name}
                      </h3>
                      <p className="text-white/90 text-sm mt-0.5">
                        {currentCard.age} · {getGenderLabel(currentCard.gender)} · {getPreferenceLabel(currentCard.sexual_preference)}
                      </p>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-[var(--matchup-text-muted)] line-clamp-3">{currentCard.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-8 mt-8">
                  <button
                    onClick={() => handleDislike(currentCard)}
                    disabled={!!actionPending}
                    className="w-16 h-16 rounded-full border-2 border-red-500/50 text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all disabled:opacity-50"
                  >
                    <i className="fa-solid fa-xmark text-2xl" />
                  </button>
                  <button
                    onClick={() => handleLike(currentCard)}
                    disabled={!!actionPending}
                    className="w-20 h-20 rounded-full bg-[var(--matchup-primary)] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all disabled:opacity-50"
                  >
                    <i className="fa-solid fa-heart text-3xl" />
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
                <div key={match.id} className="card p-0 overflow-hidden animate-fade-in">
                  <div className="relative h-48">
                    {match.matchedWith.photo_url ? (
                      <img src={match.matchedWith.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[var(--matchup-primary)] to-purple-600 flex items-center justify-center">
                        <i className="fa-solid fa-user text-4xl text-white/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-xl font-bold text-white">{match.matchedWith.first_name} {match.matchedWith.last_name}</h3>
                      <p className="text-white/90 text-xs">{match.matchedWith.age} · {getGenderLabel(match.matchedWith.gender)}</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      <a href={`tel:${match.matchedWith.phone}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--matchup-bg-input)] text-sm">
                        <i className="fa-solid fa-phone text-[var(--matchup-primary)]" /> {match.matchedWith.phone}
                      </a>
                      <a href={`https://facebrowser-tr.gta.world/profile/${match.matchedWith.facebrowser}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--matchup-bg-input)] text-sm truncate max-w-[140px]">
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

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </main>
  );
}
