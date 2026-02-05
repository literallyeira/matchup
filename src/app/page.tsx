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
  weight: number;
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
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Test mode state
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
        setShowForm(true);
        setIsLoadingMatches(false);
        return;
      }

      const response = await fetch(`/api/my-matches?characterId=${selectedCharacter.id}`);
      const data = await response.json();

      setMatches(data.matches || []);
      setHasApplication(data.hasApplication || false);
      setShowForm(!data.hasApplication);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setIsLoadingMatches(false);
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
        setFormData({
          firstName: '',
          lastName: '',
          age: '',
          weight: '',
          gender: '',
          sexualPreference: '',
          phone: '',
          facebrowser: '',
          description: '',
          photoUrl: ''
        });
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
          characterId: selectedCharacter.id,
          characterName: `${selectedCharacter.firstname} ${selectedCharacter.lastname}`
        }),
      });

      const result = await response.json();

      if (response.ok) {
        showToast('Başvurunuz başarıyla gönderildi!', 'success');
        setFormData({
          firstName: '',
          lastName: '',
          age: '',
          weight: '',
          gender: '',
          sexualPreference: '',
          phone: '',
          facebrowser: '',
          description: '',
          photoUrl: ''
        });
        // Refresh matches
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
      kadin: 'Kadın',
      diger: 'Diğer'
    };
    return labels[value] || value;
  };

  const getSexualPreferenceLabel = (value: string) => {
    const labels: Record<string, string> = {
      heteroseksuel: 'Heteroseksüel',
      homoseksuel: 'Homoseksüel',
      biseksuel: 'Biseksüel',
      diger: 'Diğer'
    };
    return labels[value] || value;
  };

  // Loading state
  if (effectiveStatus === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
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
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center animate-fade-in">
          <Image
            src="/logo.png"
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
      <main className="min-h-screen py-12 px-4">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 animate-fade-in">
            <Image
              src="/logo.png"
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
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <Image
            src="/logo.png"
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
        ) : hasApplication ? (
          <>
            {/* Matches Section */}
            {matches.length > 0 ? (
              <div className="space-y-6 animate-fade-in">
                <div className="card text-center">
                  <h2 className="text-2xl font-bold mb-2">
                    <i className="fa-solid fa-heart text-[var(--matchup-primary)] mr-2"></i>
                    Eşleşmeleriniz
                  </h2>
                  <p className="text-[var(--matchup-text-muted)]">
                    {matches.length} kişi ile eşleştiniz!
                  </p>
                </div>

                {matches.map((match, index) => (
                  <div
                    key={match.id}
                    className="card animate-fade-in"
                    style={{ animationDelay: `${0.1 * (index + 1)}s` }}
                  >
                    <div className="flex gap-4">
                      {match.matchedWith.photo_url && (
                        <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--matchup-bg-input)]">
                          <img
                            src={match.matchedWith.photo_url}
                            alt={`${match.matchedWith.first_name}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-xl font-bold">
                          {match.matchedWith.first_name} {match.matchedWith.last_name}
                        </h3>
                        {match.matchedWith.character_name && (
                          <p className="text-[var(--matchup-primary)] text-sm mb-2">
                            {match.matchedWith.character_name}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <span className="text-[var(--matchup-text-muted)]">Yaş: </span>
                            <span className="font-medium">{match.matchedWith.age}</span>
                          </div>
                          <div>
                            <span className="text-[var(--matchup-text-muted)]">Kilo: </span>
                            <span className="font-medium">{match.matchedWith.weight} kg</span>
                          </div>
                          <div>
                            <span className="text-[var(--matchup-text-muted)]">Cinsiyet: </span>
                            <span className="font-medium">{getGenderLabel(match.matchedWith.gender)}</span>
                          </div>
                          <div>
                            <span className="text-[var(--matchup-text-muted)]">Tercih: </span>
                            <span className="font-medium">{getSexualPreferenceLabel(match.matchedWith.sexual_preference)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                        <div className="flex items-center gap-2">
                          <i className="fa-solid fa-phone text-[var(--matchup-primary)]"></i>
                          <span>{match.matchedWith.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <i className="fa-solid fa-at text-[var(--matchup-primary)]"></i>
                          <span>{match.matchedWith.facebrowser}</span>
                        </div>
                      </div>
                      <div className="bg-[var(--matchup-bg-input)] rounded-xl p-3">
                        <p className="text-sm">{match.matchedWith.description}</p>
                      </div>
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
            <h2 className="text-2xl font-bold text-center mb-8">Başvuru Formu</h2>

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

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">İsim</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Adın"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Soyisim</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Soyadın"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Age & Weight */}
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="form-label">Kilo (kg)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="65"
                    min="30"
                    max="300"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
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
                    <option value="diger">Diğer</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Cinsel Tercih</label>
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
                    <option value="diger">Diğer</option>
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

        {/* Footer */}
        <p className="text-center text-[var(--matchup-text-muted)] text-sm mt-8">
          Başvuru yaparak gizlilik politikamızı kabul etmiş olursunuz.
        </p>
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
