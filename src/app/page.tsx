'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';

interface Character {
  id: number;
  memberid: number;
  firstname: string;
  lastname: string;
}

interface MatchedPerson {
  id: string;
  first_name: string;
  last_name: string;
  age: number;
  gender: string;
  sexual_preference: string;
  phone: string;
  facebrowser: string;
  description: string;
  photo_url: string;
  character_name: string;
}

interface Match {
  id: string;
  created_at: string;
  matchedWith: MatchedPerson;
  myApplicationId: string;
}

// Test mode mock data
const TEST_MODE_USER = {
  gtawId: 99999,
  username: 'TestUser',
  characters: [
    { id: 1001, memberid: 99999, firstname: 'John', lastname: 'Doe' },
    { id: 1002, memberid: 99999, firstname: 'Jane', lastname: 'Smith' },
    { id: 1003, memberid: 99999, firstname: 'Alex', lastname: 'Johnson' },
  ]
};

export default function Home() {
  const { data: session, status } = useSession();
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [hasApplication, setHasApplication] = useState(false);
  const [userApplication, setUserApplication] = useState<MatchedPerson | null>(null);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Test mode state
  const [testMode, setTestMode] = useState(false);
  const [testModeLoggedIn, setTestModeLoggedIn] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    age: '',
    gender: '',
    sexualPreference: '',
    phone: '',
    facebrowser: '',
    description: '',
    photoUrl: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Check for test mode from localStorage
  useEffect(() => {
    const savedTestMode = localStorage.getItem('matchup_test_mode');
    if (savedTestMode === 'true') {
      setTestMode(true);
    }
  }, []);

  // Get effective session (real or test mode)
  const effectiveSession = testMode && testModeLoggedIn ? {
    user: {
      ...TEST_MODE_USER,
      name: TEST_MODE_USER.username
    }
  } : session;

  const effectiveStatus = testMode ? (testModeLoggedIn ? 'authenticated' : 'unauthenticated') : status;

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch matches when character is selected
  useEffect(() => {
    const gtawId = testMode ? TEST_MODE_USER.gtawId : session?.user?.gtawId;
    if (selectedCharacter && gtawId) {
      fetchMatches();
    }
  }, [selectedCharacter, session?.user?.gtawId, testMode]);

  const fetchMatches = async () => {
    if (!selectedCharacter) return;

    setIsLoadingMatches(true);
    try {
      // In test mode, simulate API response
      if (testMode) {
        // Simulate delay
        await new Promise(r => setTimeout(r, 500));
        setMatches([]);
        setHasApplication(false);
        setUserApplication(null);
        setShowForm(true);
        setIsLoadingMatches(false);
        return;
      }

      const response = await fetch(`/api/my-matches?characterId=${selectedCharacter.id}`);
      const data = await response.json();

      setMatches(data.matches || []);
      setHasApplication(data.hasApplication || false);
      setUserApplication(data.application || null);
      setShowForm(!data.hasApplication);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const startEditing = () => {
    if (!userApplication) return;

    setFormData({
      firstName: userApplication.first_name,
      lastName: userApplication.last_name,
      age: userApplication.age.toString(),
      gender: userApplication.gender,
      sexualPreference: userApplication.sexual_preference,
      phone: userApplication.phone,
      facebrowser: userApplication.facebrowser,
      description: userApplication.description,
      photoUrl: userApplication.photo_url
    });
    setShowForm(true);
  };

  const rejectMatch = async (matchId: string, myApplicationId: string, matchedApplicationId: string) => {
    if (!confirm('Bu eşleşmeyi reddetmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;

    setRejectingId(matchId);
    try {
      const response = await fetch('/api/reject-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, myApplicationId, matchedApplicationId })
      });

      if (response.ok) {
        setMatches(matches.filter(m => m.id !== matchId));
        showToast('Eşleşme reddedildi.', 'success');
      } else {
        showToast('Bir hata oluştu.', 'error');
      }
    } catch {
      showToast('Bağlantı hatası!', 'error');
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
      // In test mode, simulate success
      if (testMode) {
        await new Promise(r => setTimeout(r, 1000));
        showToast('(TEST) Başvurunuz başarıyla gönderildi!', 'success');
        setHasApplication(true);
        setShowForm(false);
        setIsSubmitting(false);
        return;
      }

      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          firstName: selectedCharacter.firstname,
          lastName: selectedCharacter.lastname,
          characterId: selectedCharacter.id,
          characterName: `${selectedCharacter.firstname} ${selectedCharacter.lastname}`
        }),
      });

      const result = await response.json();

      if (response.ok) {
        showToast(hasApplication ? 'Profiliniz güncellendi!' : 'Başvurunuz başarıyla gönderildi!', 'success');
        // Refresh everything
        fetchMatches();
      } else {
        showToast(result.error || 'Bir hata oluştu!', 'error');
      }
    } catch {
      showToast('Bağlantı hatası! Lütfen tekrar deneyin.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestModeLogin = () => {
    setTestModeLoggedIn(true);
  };

  const handleTestModeLogout = () => {
    setTestModeLoggedIn(false);
    setSelectedCharacter(null);
    setMatches([]);
    setHasApplication(false);
  };

  const getGenderLabel = (value: string) => {
    const labels: Record<string, string> = {
      erkek: 'Erkek',
      kadin: 'Kadın'
    };
    return labels[value] || value;
  };

  const getSexualPreferenceLabel = (value: string) => {
    const labels: Record<string, string> = {
      heteroseksuel: 'Heteroseksüel',
      homoseksuel: 'Homoseksüel',
      biseksuel: 'Biseksüel'
    };
    return labels[value] || value;
  };

  // Loading state
  if (effectiveStatus === 'loading') {
    return (
      <main className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-[var(--matchup-primary)] border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-[var(--matchup-text-muted)]">Yükleniyor...</p>
        </div>
      </main>
    );
  }

  // Not logged in - show login button
  if (!effectiveSession) {
    return (
      <main className="flex items-center justify-center px-4 py-20">
        <div className="card max-w-md w-full text-center animate-fade-in">
          <Image
            src="/matchup_logo.png"
            alt="MatchUp Logo"
            width={220}
            height={60}
            className="mx-auto mb-6"
            priority
          />
          <p className="text-[var(--matchup-text-muted)] text-lg mb-8">
            <i className="fa-solid fa-heart text-[var(--matchup-primary)] mr-2"></i>
            Hayatının aşkını bulmaya bir adım kaldı!
          </p>

          {testMode ? (
            <button
              onClick={handleTestModeLogin}
              className="btn-primary flex items-center justify-center gap-3"
            >
              <i className="fa-solid fa-flask"></i>
              Test Kullanıcısı Olarak Giriş Yap
            </button>
          ) : (
            <button
              onClick={() => signIn('gtaw')}
              className="btn-primary flex items-center justify-center gap-3"
            >
              <i className="fa-solid fa-right-to-bracket"></i>
              GTA World ile Giriş Yap
            </button>
          )}

          <p className="text-[var(--matchup-text-muted)] text-sm mt-6">
            Giriş yaparak gizlilik politikamızı kabul etmiş olursunuz.
          </p>

          {/* Test Mode Indicator */}
          {testMode && (
            <div className="mt-6 p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/50">
              <p className="text-yellow-400 text-sm">
                <i className="fa-solid fa-flask mr-2"></i>
                Test Modu Aktif
              </p>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Logged in but no character selected
  if (!selectedCharacter) {
    const characters = testMode ? TEST_MODE_USER.characters : (effectiveSession.user.characters || []);

    return (
      <main className="py-12 px-4">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 animate-fade-in">
            <Image
              src="/matchup_logo.png"
              alt="MatchUp Logo"
              width={140}
              height={40}
              priority
            />
            <div className="flex items-center gap-3">
              <span className="text-[var(--matchup-text-muted)] text-sm">
                {testMode ? TEST_MODE_USER.username : effectiveSession.user.username}
                {testMode && <span className="text-yellow-400 ml-1">(TEST)</span>}
              </span>
              <button
                onClick={() => testMode ? handleTestModeLogout() : signOut()}
                className="btn-secondary text-sm"
              >
                Çıkış
              </button>
            </div>
          </div>

          {/* Character Selection */}
          <div className="card animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-2xl font-bold text-center mb-2">Karakter Seç</h2>
            <p className="text-[var(--matchup-text-muted)] text-center mb-6">
              Hangi karakteriniz için başvuru yapmak istiyorsunuz?
            </p>

            {characters.length === 0 ? (
              <p className="text-center text-[var(--matchup-text-muted)]">
                Hesabınızda karakter bulunamadı.
              </p>
            ) : (
              <div className="space-y-3">
                {characters.map((char: Character) => (
                  <button
                    key={char.id}
                    onClick={() => setSelectedCharacter(char)}
                    className="w-full p-4 rounded-xl bg-[var(--matchup-bg-input)] hover:bg-[var(--matchup-primary)] hover:text-white transition-all text-left flex items-center justify-between group"
                  >
                    <span className="font-semibold">
                      {char.firstname} {char.lastname}
                    </span>
                    <i className="fa-solid fa-arrow-right opacity-0 group-hover:opacity-100 transition-opacity"></i>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Test Mode Indicator */}
          {testMode && (
            <div className="mt-6 p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/50 text-center">
              <p className="text-yellow-400 text-sm">
                <i className="fa-solid fa-flask mr-2"></i>
                Test Modu - Veriler kaydedilmeyecek
              </p>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Character selected - show matches or form
  return (
    <main className="py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <Image
            src="/matchup_logo.png"
            alt="MatchUp Logo"
            width={140}
            height={40}
            priority
          />
          <div className="flex items-center gap-3">
            <span className="text-[var(--matchup-text-muted)] text-sm">
              {selectedCharacter.firstname} {selectedCharacter.lastname}
              {testMode && <span className="text-yellow-400 ml-1">(TEST)</span>}
            </span>
            <button
              onClick={() => setSelectedCharacter(null)}
              className="btn-secondary text-sm"
            >
              Değiştir
            </button>
          </div>
        </div>

        {/* Test Mode Banner */}
        {testMode && (
          <div className="mb-6 p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/50 text-center animate-fade-in">
            <p className="text-yellow-400 text-sm">
              <i className="fa-solid fa-flask mr-2"></i>
              Test Modu Aktif - İşlemler simüle edilecek
            </p>
          </div>
        )}

        {isLoadingMatches ? (
          <div className="text-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-[var(--matchup-primary)] border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-[var(--matchup-text-muted)]">Yükleniyor...</p>
          </div>
        ) : hasApplication && !showForm ? (
          <>
            {/* Matches Section or Profile Header */}
            <div className="card mb-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in">
              <div className="text-center md:text-left">
                <h2 className="text-2xl font-bold">
                  {matches.length > 0 ? (
                    <><i className="fa-solid fa-heart text-[var(--matchup-primary)] mr-2"></i>Eşleşmeleriniz</>
                  ) : (
                    <>Profilin Hazır!</>
                  )}
                </h2>
                <p className="text-[var(--matchup-text-muted)]">
                  {matches.length > 0 ? `${matches.length} kişi ile eşleştiniz!` : 'Henüz bir eşleşme yok, takipte kal!'}
                </p>
              </div>
              <button
                onClick={startEditing}
                className="btn-secondary flex items-center gap-2 whitespace-nowrap"
              >
                <i className="fa-solid fa-user-pen"></i>
                Profilimi Düzenle
              </button>
            </div>

            {/* Matches List */}
            {matches.length > 0 ? (
              <div className="space-y-6 animate-fade-in">

                {matches.map((match, index) => (
                  <div
                    key={match.id}
                    className="card animate-fade-in overflow-hidden p-0"
                    style={{ animationDelay: `${0.1 * (index + 1)}s` }}
                  >
                    {/* Photo with gradient overlay */}
                    <div className="relative h-64 w-full">
                      {match.matchedWith.photo_url ? (
                        <img
                          src={match.matchedWith.photo_url}
                          alt={`${match.matchedWith.first_name}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[var(--matchup-primary)] to-purple-600 flex items-center justify-center">
                          <i className="fa-solid fa-user text-6xl text-white/50"></i>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>

                      {/* Name overlay on photo */}
                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="text-2xl font-bold text-white drop-shadow-lg">
                          {match.matchedWith.first_name} {match.matchedWith.last_name}
                        </h3>

                      </div>

                      {/* Heart badge */}
                      <div className="absolute top-4 right-4 bg-[var(--matchup-primary)] rounded-full p-3 shadow-lg">
                        <i className="fa-solid fa-heart text-white text-xl"></i>
                      </div>
                    </div>

                    {/* Info section */}
                    <div className="p-5">
                      {/* Quick stats */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="px-3 py-1 rounded-full bg-[var(--matchup-bg-input)] text-sm">
                          <i className="fa-solid fa-cake-candles mr-1 text-[var(--matchup-primary)]"></i>
                          {match.matchedWith.age} yaş
                        </span>

                        <span className="px-3 py-1 rounded-full bg-[var(--matchup-bg-input)] text-sm">
                          <i className="fa-solid fa-venus-mars mr-1 text-[var(--matchup-primary)]"></i>
                          {getGenderLabel(match.matchedWith.gender)}
                        </span>
                      </div>

                      {/* Contact info */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <a
                          href={`tel:${match.matchedWith.phone}`}
                          className="flex items-center gap-2 p-3 rounded-xl bg-[var(--matchup-bg-input)] hover:bg-white/10 transition-colors"
                        >
                          <i className="fa-solid fa-phone text-[var(--matchup-primary)]"></i>
                          <span className="text-sm font-medium">{match.matchedWith.phone}</span>
                        </a>
                        <a
                          href={`https://facebrowser-tr.gta.world/profile/${match.matchedWith.facebrowser}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 rounded-xl bg-[var(--matchup-bg-input)] hover:bg-white/10 transition-colors"
                        >
                          <i className="fa-solid fa-at text-[var(--matchup-primary)]"></i>
                          <span className="text-sm font-medium truncate">{match.matchedWith.facebrowser}</span>
                        </a>
                      </div>

                      {/* Description */}
                      <div className="bg-[var(--matchup-bg-input)] rounded-xl p-4 mb-4">
                        <p className="text-sm leading-relaxed">{match.matchedWith.description}</p>
                      </div>

                      {/* Reject button */}
                      <button
                        onClick={() => rejectMatch(match.id, match.myApplicationId, match.matchedWith.id)}
                        disabled={rejectingId === match.id}
                        className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {rejectingId === match.id ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Reddediliyor...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-xmark"></i>
                            Bu Eşleşmeyi Reddet
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={fetchMatches}
                  className="btn-secondary w-full"
                >
                  <i className="fa-solid fa-rotate-right mr-2"></i>
                  Yenile
                </button>
              </div>
            ) : (
              /* No matches yet */
              <div className="card text-center animate-fade-in">
                <div className="py-8">
                  <i className="fa-solid fa-heart-crack text-6xl text-[var(--matchup-text-muted)] mb-4"></i>
                  <h2 className="text-2xl font-bold mb-2">Henüz Eşleşmedin</h2>
                  <p className="text-[var(--matchup-text-muted)] mb-6">
                    Merak etme, yakında eşleşeceksin! Kontrol etmeye devam et.
                  </p>
                  <button
                    onClick={fetchMatches}
                    className="btn-primary"
                  >
                    <i className="fa-solid fa-rotate-right mr-2"></i>
                    Yenile
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Application Form */
          <div className="card animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">{hasApplication ? 'Profili Düzenle' : 'Başvuru Formu'}</h2>
              {hasApplication && (
                <button
                  onClick={() => setShowForm(false)}
                  className="text-[var(--matchup-text-muted)] hover:text-white transition-colors"
                >
                  <i className="fa-solid fa-xmark mr-1"></i>
                  Vazgeç
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Photo URL */}
              <div>
                <label className="form-label">Fotoğraf Linki</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://example.com/foto.jpg"
                  value={formData.photoUrl}
                  onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                  required
                />
                {formData.photoUrl && (
                  <div className="mt-3 flex justify-center">
                    <img
                      src={formData.photoUrl}
                      alt="Önizleme"
                      className="w-32 h-32 object-cover rounded-xl border-2 border-[var(--matchup-primary)]"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
              </div>



              {/* Age */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="form-label">Yaş</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="25"
                    min="18"
                    max="99"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Gender & Sexual Preference */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Cinsiyet</label>
                  <select
                    className="form-input"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    required
                  >
                    <option value="">Seçiniz</option>
                    <option value="erkek">Erkek</option>
                    <option value="kadin">Kadın</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Yönelim</label>
                  <select
                    className="form-input"
                    value={formData.sexualPreference}
                    onChange={(e) => setFormData({ ...formData, sexualPreference: e.target.value })}
                    required
                  >
                    <option value="">Seçiniz</option>
                    <option value="heteroseksuel">Heteroseksüel</option>
                    <option value="homoseksuel">Homoseksüel</option>
                    <option value="biseksuel">Biseksüel</option>
                  </select>
                </div>
              </div>

              {/* Phone & Facebrowser */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Telefon No</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="555-1234"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Facebrowser</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="@kullaniciadi"
                    value={formData.facebrowser}
                    onChange={(e) => setFormData({ ...formData, facebrowser: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="form-label">Kendini Tanıt</label>
                <textarea
                  className="form-input min-h-[120px] resize-none"
                  placeholder="Kendinden biraz bahset... Hobilerin, ilgi alanların, aradığın kişi..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-primary mt-8"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Gönderiliyor...
                  </span>
                ) : (
                  <><i className="fa-solid fa-heart-circle-check mr-2"></i>Başvur</>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </main>
  );
}
