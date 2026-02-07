'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { Application, Match } from '@/lib/supabase';

interface MatchWithApps extends Match {
    application_1: Application;
    application_2: Application;
}

export default function AdminPage() {
    const { data: session, status: sessionStatus } = useSession();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [applications, setApplications] = useState<Application[]>([]);
    const [matches, setMatches] = useState<MatchWithApps[]>([]);
    const [rejectedPairs, setRejectedPairs] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'applications' | 'matches' | 'suggestions'>('applications');

    // Filters
    const [filterGender, setFilterGender] = useState('');
    const [filterPreference, setFilterPreference] = useState('');

    // Matching state
    const [selectedForMatch, setSelectedForMatch] = useState<string[]>([]);
    const [isCreatingMatch, setIsCreatingMatch] = useState(false);

    // Test mode state
    const [testMode, setTestMode] = useState(false);

    // Load test mode from localStorage
    useEffect(() => {
        const savedTestMode = localStorage.getItem('matchup_test_mode');
        setTestMode(savedTestMode === 'true');
    }, []);

    const toggleTestMode = () => {
        const newValue = !testMode;
        setTestMode(newValue);
        localStorage.setItem('matchup_test_mode', newValue.toString());
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/applications', {
                headers: {
                    'Authorization': password
                }
            });

            if (response.ok) {
                const data = await response.json();
                setApplications(data);
                setIsAuthenticated(true);
                localStorage.setItem('adminPassword', password);
                fetchMatches(password);
            } else {
                setError('Yanlış şifre!');
            }
        } catch {
            setError('Bağlantı hatası!');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchApplications = async (savedPassword?: string) => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/applications', {
                headers: {
                    'Authorization': savedPassword || password,
                    'X-Admin-Name': (session?.user as any)?.username || 'admin'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setApplications(data);
            }
        } catch {
            console.error('Fetch error');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMatches = async (savedPassword?: string) => {
        try {
            const response = await fetch('/api/matches', {
                headers: {
                    'Authorization': savedPassword || password,
                    'X-Admin-Name': (session?.user as any)?.username || 'admin'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setMatches(data);
            }
        } catch {
            console.error('Fetch matches error');
        }
    };

    const fetchRejectedPairs = async (savedPassword?: string) => {
        try {
            const response = await fetch('/api/rejected-matches', {
                headers: {
                    'Authorization': savedPassword || password
                }
            });

            if (response.ok) {
                const data = await response.json();
                const pairs = new Set<string>();
                data.forEach((r: { application_1_id: string; application_2_id: string }) => {
                    pairs.add([r.application_1_id, r.application_2_id].sort().join('-'));
                });
                setRejectedPairs(pairs);
            }
        } catch {
            console.error('Fetch rejected error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bu başvuruyu silmek istediğinize emin misiniz?')) return;

        try {
            const response = await fetch('/api/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': password || localStorage.getItem('adminPassword') || '',
                    'X-Admin-Name': (session?.user as any)?.username || 'admin'
                },
                body: JSON.stringify({ id })
            });

            if (response.ok) {
                setApplications(applications.filter(app => app.id !== id));
            }
        } catch {
            console.error('Delete error');
        }
    };

    const handleDeleteMatch = async (id: string) => {
        if (!confirm('Bu eşleşmeyi silmek istediğinize emin misiniz?')) return;

        try {
            const response = await fetch(`/api/matches?id=${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': password || localStorage.getItem('adminPassword') || '',
                    'X-Admin-Name': (session?.user as any)?.username || 'admin'
                }
            });

            if (response.ok) {
                setMatches(matches.filter(m => m.id !== id));
            }
        } catch {
            console.error('Delete match error');
        }
    };

    const handleCreateMatch = async () => {
        if (selectedForMatch.length !== 2) {
            alert('Lütfen tam olarak 2 kişi seçin!');
            return;
        }

        setIsCreatingMatch(true);
        try {
            const response = await fetch('/api/matches', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': password || localStorage.getItem('adminPassword') || '',
                    'X-Admin-Name': (session?.user as any)?.username || 'admin'
                },
                body: JSON.stringify({
                    application1Id: selectedForMatch[0],
                    application2Id: selectedForMatch[1]
                })
            });

            const result = await response.json();

            if (response.ok) {
                alert('Eşleştirme başarılı!');
                setSelectedForMatch([]);
                fetchMatches();
            } else {
                alert(result.error || 'Eşleştirme hatası!');
            }
        } catch {
            alert('Bağlantı hatası!');
        } finally {
            setIsCreatingMatch(false);
        }
    };

    const toggleSelectForMatch = (id: string) => {
        if (selectedForMatch.includes(id)) {
            setSelectedForMatch(selectedForMatch.filter(x => x !== id));
        } else if (selectedForMatch.length < 2) {
            setSelectedForMatch([...selectedForMatch, id]);
        } else {
            // Replace the first selection
            setSelectedForMatch([selectedForMatch[1], id]);
        }
    };

    // Get matches for a specific application
    const getMatchesForApp = (appId: string): Application[] => {
        const matchedApps: Application[] = [];
        matches.forEach(m => {
            if (m.application_1_id === appId && m.application_2) {
                matchedApps.push(m.application_2);
            } else if (m.application_2_id === appId && m.application_1) {
                matchedApps.push(m.application_1);
            }
        });
        return matchedApps;
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setPassword('');
        setApplications([]);
        setMatches([]);
        setRejectedPairs(new Set());
        localStorage.removeItem('adminPassword');
    };

    useEffect(() => {
        const savedPassword = localStorage.getItem('adminPassword');
        if (savedPassword) {
            setPassword(savedPassword);
            setIsAuthenticated(true);
            fetchApplications(savedPassword);
            fetchMatches(savedPassword);
            fetchRejectedPairs(savedPassword);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Filtered applications
    const filteredApplications = useMemo(() => {
        return applications.filter(app => {
            if (filterGender && app.gender !== filterGender) return false;
            if (filterPreference && app.sexual_preference !== filterPreference) return false;
            return true;
        });
    }, [applications, filterGender, filterPreference]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
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

    // Check if two people are compatible
    const areCompatible = (app1: Application, app2: Application): boolean => {
        // Already matched?
        const alreadyMatched = matches.some(m =>
            (m.application_1_id === app1.id && m.application_2_id === app2.id) ||
            (m.application_1_id === app2.id && m.application_2_id === app1.id)
        );
        if (alreadyMatched) return false;

        // Already rejected?
        const pairKey = [app1.id, app2.id].sort().join('-');
        if (rejectedPairs.has(pairKey)) return false;

        const g1 = app1.gender;
        const g2 = app2.gender;
        const p1 = app1.sexual_preference;
        const p2 = app2.sexual_preference;

        // Heterosexual logic
        if (p1 === 'heteroseksuel' && p2 === 'heteroseksuel') {
            return (g1 === 'erkek' && g2 === 'kadin') || (g1 === 'kadin' && g2 === 'erkek');
        }

        // Homosexual logic
        if (p1 === 'homoseksuel' && p2 === 'homoseksuel') {
            return g1 === g2;
        }

        // Bisexual is compatible with anyone who might be interested
        if (p1 === 'biseksuel') {
            if (p2 === 'biseksuel') return true;
            if (p2 === 'heteroseksuel') return (g1 !== g2);
            if (p2 === 'homoseksuel') return (g1 === g2);
        }
        if (p2 === 'biseksuel') {
            if (p1 === 'heteroseksuel') return (g1 !== g2);
            if (p1 === 'homoseksuel') return (g1 === g2);
        }


        return false;
    };

    // Get suggested matches (compatible pairs)
    const suggestedMatches = useMemo(() => {
        const suggestions: { app1: Application; app2: Application }[] = [];
        const seen = new Set<string>();

        for (let i = 0; i < applications.length; i++) {
            for (let j = i + 1; j < applications.length; j++) {
                const app1 = applications[i];
                const app2 = applications[j];
                const key = [app1.id, app2.id].sort().join('-');

                if (!seen.has(key) && areCompatible(app1, app2)) {
                    seen.add(key);
                    suggestions.push({ app1, app2 });
                }
            }
        }

        return suggestions;
    }, [applications, matches]);

    // Quick match function
    const quickMatch = async (app1Id: string, app2Id: string) => {
        setIsCreatingMatch(true);
        try {
            const response = await fetch('/api/matches', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': password || localStorage.getItem('adminPassword') || '',
                    'X-Admin-Name': (session?.user as any)?.username || 'admin'
                },
                body: JSON.stringify({
                    application1Id: app1Id,
                    application2Id: app2Id
                })
            });

            if (response.ok) {
                fetchMatches();
            } else {
                const result = await response.json();
                alert(result.error || 'Eşleştirme hatası!');
            }
        } catch {
            alert('Bağlantı hatası!');
        } finally {
            setIsCreatingMatch(false);
        }
    };

    // Login Screen
    if (!isAuthenticated) {
        return (
            <main className="flex items-center justify-center px-4 py-20">
                <div className="card max-w-md w-full animate-fade-in">
                    <div className="text-center mb-8">
                        <Image
                            src="/matchup_logo.png"
                            alt="MatchUp Logo"
                            width={180}
                            height={50}
                            className="mx-auto mb-4"
                            priority
                        />
                        <h1 className="text-2xl font-bold">Admin Paneli</h1>
                        {session?.user ? (
                            <p className="text-[var(--matchup-text-muted)] mt-2">Merhaba, <span className="text-white font-medium">{(session.user as any).username || session.user.name}</span></p>
                        ) : (
                            <p className="text-orange-400 mt-2">Lütfen önce UCP ile giriş yapın.</p>
                        )}
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="form-label">Şifre</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <p className="text-red-500 text-sm text-center">{error}</p>
                        )}

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <a href="/" className="text-[var(--matchup-text-muted)] hover:text-[var(--matchup-primary)] text-sm">
                            ← Ana Sayfaya Dön
                        </a>
                    </div>
                </div>
            </main>
        );
    }

    // Admin Dashboard
    return (
        <main className="py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 animate-fade-in">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="inline-block hover:opacity-90 transition-opacity">
                            <Image
                                src="/matchup_logo.png"
                                alt="MatchUp Logo"
                                width={140}
                                height={40}
                                priority
                            />
                        </Link>
                        <span className="text-[var(--matchup-text-muted)]">Admin Paneli</span>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Test Mode Toggle */}
                        <button
                            onClick={toggleTestMode}
                            className={`px-4 py-2 rounded-xl font-semibold transition-all flex items-center gap-2 ${testMode
                                ? 'bg-yellow-500 text-black'
                                : 'bg-[var(--matchup-bg-card)] hover:bg-[var(--matchup-bg-input)]'
                                }`}
                        >
                            <i className="fa-solid fa-flask"></i>
                            {testMode ? 'Test Modu: Açık' : 'Test Modu: Kapalı'}
                        </button>
                        <button
                            onClick={() => { fetchApplications(); fetchMatches(); }}
                            className="btn-secondary"
                        >
                            <i className="fa-solid fa-rotate-right mr-2"></i>Yenile
                        </button>
                        <button
                            onClick={handleLogout}
                            className="btn-secondary"
                        >
                            Çıkış
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 animate-fade-in flex-wrap">
                    <button
                        onClick={() => setActiveTab('applications')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'applications'
                            ? 'bg-[var(--matchup-primary)] text-white'
                            : 'bg-[var(--matchup-bg-card)] hover:bg-[var(--matchup-bg-input)]'
                            }`}
                    >
                        <i className="fa-solid fa-users mr-2"></i>Başvurular ({applications.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('suggestions')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'suggestions'
                            ? 'bg-green-500 text-white'
                            : 'bg-[var(--matchup-bg-card)] hover:bg-[var(--matchup-bg-input)]'
                            }`}
                    >
                        <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>Önerilen ({suggestedMatches.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('matches')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'matches'
                            ? 'bg-[var(--matchup-primary)] text-white'
                            : 'bg-[var(--matchup-bg-card)] hover:bg-[var(--matchup-bg-input)]'
                            }`}
                    >
                        <i className="fa-solid fa-heart mr-2"></i>Eşleşmeler ({matches.length})
                    </button>
                </div>

                {activeTab === 'applications' && (
                    <>
                        {/* Matching Banner */}
                        {selectedForMatch.length > 0 && (
                            <div className="card mb-6 bg-gradient-to-r from-[var(--matchup-primary)] to-pink-600 animate-fade-in">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-white">
                                            {selectedForMatch.length}/2 Kişi Seçildi
                                        </h3>
                                        <p className="text-white/80 text-sm">
                                            Eşleştirmek için 2 kişi seçin
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setSelectedForMatch([])}
                                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-all"
                                        >
                                            Temizle
                                        </button>
                                        <button
                                            onClick={handleCreateMatch}
                                            disabled={selectedForMatch.length !== 2 || isCreatingMatch}
                                            className="px-4 py-2 bg-white text-[var(--matchup-primary)] rounded-lg font-semibold hover:bg-white/90 transition-all disabled:opacity-50"
                                        >
                                            {isCreatingMatch ? 'Eşleştiriliyor...' : 'Eşleştir'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Stats */}
                        <div className="card mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold">Toplam Başvuru</h2>
                                    <p className="text-[var(--matchup-text-muted)]">
                                        {filterGender || filterPreference
                                            ? `Filtrelenen: ${filteredApplications.length} / ${applications.length}`
                                            : 'Sistemdeki tüm başvurular'}
                                    </p>
                                </div>
                                <div className="text-4xl font-bold text-[var(--matchup-primary)]">
                                    {filteredApplications.length}
                                </div>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="card mb-8 animate-fade-in" style={{ animationDelay: '0.15s' }}>
                            <h3 className="font-semibold mb-4"><i className="fa-solid fa-filter mr-2"></i>Filtrele</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="form-label text-sm">Cinsiyet</label>
                                    <select
                                        className="form-input"
                                        value={filterGender}
                                        onChange={(e) => setFilterGender(e.target.value)}
                                    >
                                        <option value="">Tümü</option>
                                        <option value="erkek">Erkek</option>
                                        <option value="kadin">Kadın</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label text-sm">Yönelim</label>
                                    <select
                                        className="form-input"
                                        value={filterPreference}
                                        onChange={(e) => setFilterPreference(e.target.value)}
                                    >
                                        <option value="">Tümü</option>
                                        <option value="heteroseksuel">Heteroseksüel</option>
                                        <option value="homoseksuel">Homoseksüel</option>
                                        <option value="biseksuel">Biseksüel</option>
                                    </select>
                                </div>
                                <div className="col-span-2 flex items-end">
                                    <button
                                        onClick={() => { setFilterGender(''); setFilterPreference(''); }}
                                        className="btn-secondary w-full"
                                    >
                                        <i className="fa-solid fa-xmark mr-2"></i>Filtreleri Temizle
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Applications List */}
                        {isLoading ? (
                            <div className="text-center py-20">
                                <div className="animate-spin w-10 h-10 border-4 border-[var(--matchup-primary)] border-t-transparent rounded-full mx-auto"></div>
                                <p className="mt-4 text-[var(--matchup-text-muted)]">Yükleniyor...</p>
                            </div>
                        ) : filteredApplications.length === 0 ? (
                            <div className="card text-center py-16 animate-fade-in">
                                <p className="text-[var(--matchup-text-muted)] text-lg">
                                    {applications.length === 0 ? 'Henüz başvuru yok' : 'Filtrelere uygun başvuru bulunamadı'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-6">
                                {filteredApplications.map((app, index) => {
                                    const isSelected = selectedForMatch.includes(app.id);
                                    const appMatches = getMatchesForApp(app.id);

                                    return (
                                        <div
                                            key={app.id}
                                            className={`card animate-fade-in cursor-pointer transition-all ${isSelected ? 'ring-2 ring-[var(--matchup-primary)]' : ''
                                                }`}
                                            style={{ animationDelay: `${0.05 * index}s` }}
                                            onClick={() => toggleSelectForMatch(app.id)}
                                        >
                                            <div className="flex flex-col md:flex-row gap-6">
                                                {/* Selection Checkbox */}
                                                <div className="flex items-center">
                                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected
                                                        ? 'bg-[var(--matchup-primary)] border-[var(--matchup-primary)]'
                                                        : 'border-[var(--matchup-text-muted)]'
                                                        }`}>
                                                        {isSelected && <i className="fa-solid fa-check text-white text-xs"></i>}
                                                    </div>
                                                </div>

                                                {/* Photo */}
                                                <div
                                                    className="w-32 h-32 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer bg-[var(--matchup-bg-input)]"
                                                    onClick={(e) => { e.stopPropagation(); app.photo_url && setSelectedImage(app.photo_url); }}
                                                >
                                                    {app.photo_url ? (
                                                        <img
                                                            src={app.photo_url}
                                                            alt={`${app.first_name} ${app.last_name}`}
                                                            className="w-full h-full object-cover hover:scale-110 transition-transform"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[var(--matchup-text-muted)]">
                                                            Foto Yok
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div>
                                                            <h3 className="text-xl font-bold">
                                                                {app.first_name} {app.last_name}
                                                            </h3>
                                                            {app.character_name && (
                                                                <p className="text-[var(--matchup-primary)] text-sm">
                                                                    {app.character_name}
                                                                </p>
                                                            )}
                                                            <p className="text-[var(--matchup-text-muted)] text-sm">
                                                                {formatDate(app.created_at)}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(app.id); }}
                                                            className="btn-danger"
                                                        >
                                                            <i className="fa-solid fa-trash mr-2"></i>Sil
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                                                        <div>
                                                            <span className="text-[var(--matchup-text-muted)] text-sm">Yaş</span>
                                                            <p className="font-semibold">{app.age}</p>
                                                        </div>

                                                        <div>
                                                            <span className="text-[var(--matchup-text-muted)] text-sm">Cinsiyet</span>
                                                            <p className="font-semibold">{getGenderLabel(app.gender)}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[var(--matchup-text-muted)] text-sm">Yönelim</span>
                                                            <p className="font-semibold">{getSexualPreferenceLabel(app.sexual_preference)}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[var(--matchup-text-muted)] text-sm">Telefon</span>
                                                            <p className="font-semibold">{app.phone || '-'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[var(--matchup-text-muted)] text-sm">Facebrowser</span>
                                                            <p className="font-semibold">{app.facebrowser || '-'}</p>
                                                        </div>
                                                    </div>

                                                    <div className="bg-[var(--matchup-bg-input)] rounded-xl p-4">
                                                        <span className="text-[var(--matchup-text-muted)] text-sm block mb-2">Açıklama</span>
                                                        <p className="text-sm leading-relaxed">{app.description}</p>
                                                    </div>

                                                    {/* Current Matches for this person */}
                                                    {appMatches.length > 0 && (
                                                        <div className="mt-4 pt-4 border-t border-white/10">
                                                            <span className="text-[var(--matchup-text-muted)] text-sm block mb-2">
                                                                <i className="fa-solid fa-heart mr-1"></i>
                                                                Eşleşmeleri ({appMatches.length})
                                                            </span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {appMatches.map(match => (
                                                                    <span
                                                                        key={match.id}
                                                                        className="px-3 py-1 bg-[var(--matchup-primary)]/20 text-[var(--matchup-primary)] rounded-full text-sm"
                                                                    >
                                                                        {match.first_name} {match.last_name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'suggestions' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="card bg-gradient-to-r from-green-600 to-emerald-600">
                            <div className="flex items-center gap-3">

                                <div>
                                    <h2 className="text-xl font-bold">Önerilen Eşleşmeler</h2>
                                    <p className="text-white/80 text-sm">
                                        Cinsiyet ve yönelime göre uyumlu kişiler otomatik tespit edildi
                                    </p>
                                </div>
                            </div>
                        </div>

                        {suggestedMatches.length === 0 ? (
                            <div className="card text-center py-16">
                                <i className="fa-solid fa-check-circle text-6xl text-green-500 mb-4"></i>
                                <p className="text-[var(--matchup-text-muted)] text-lg">
                                    Tüm uyumlu kişiler eşleştirilmiş!
                                </p>
                            </div>
                        ) : (
                            suggestedMatches.map(({ app1, app2 }, index) => (
                                <div
                                    key={`${app1.id}-${app2.id}`}
                                    className="card animate-fade-in"
                                    style={{ animationDelay: `${0.05 * index}s` }}
                                >
                                    <div className="flex flex-col md:flex-row items-center gap-4">
                                        {/* Person 1 */}
                                        <div className="flex-1 flex items-center gap-4">
                                            {app1.photo_url && (
                                                <div
                                                    className="w-16 h-16 rounded-full overflow-hidden cursor-pointer flex-shrink-0"
                                                    onClick={() => setSelectedImage(app1.photo_url)}
                                                >
                                                    <img src={app1.photo_url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold">{app1.first_name} {app1.last_name}</p>
                                                <div className="flex gap-2 text-sm">
                                                    <span className="px-2 py-0.5 rounded bg-[var(--matchup-bg-input)]">
                                                        {getGenderLabel(app1.gender)}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded bg-[var(--matchup-bg-input)]">
                                                        {getSexualPreferenceLabel(app1.sexual_preference)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Match Icon */}
                                        <div className="text-3xl text-[var(--matchup-primary)]">
                                            <i className="fa-solid fa-heart"></i>
                                        </div>

                                        {/* Person 2 */}
                                        <div className="flex-1 flex items-center gap-4 md:flex-row-reverse md:text-right">
                                            {app2.photo_url && (
                                                <div
                                                    className="w-16 h-16 rounded-full overflow-hidden cursor-pointer flex-shrink-0"
                                                    onClick={() => setSelectedImage(app2.photo_url)}
                                                >
                                                    <img src={app2.photo_url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold">{app2.first_name} {app2.last_name}</p>
                                                <div className="flex gap-2 text-sm md:justify-end">
                                                    <span className="px-2 py-0.5 rounded bg-[var(--matchup-bg-input)]">
                                                        {getGenderLabel(app2.gender)}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded bg-[var(--matchup-bg-input)]">
                                                        {getSexualPreferenceLabel(app2.sexual_preference)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Match Button */}
                                        <button
                                            onClick={() => quickMatch(app1.id, app2.id)}
                                            disabled={isCreatingMatch}
                                            className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                                        >
                                            <i className="fa-solid fa-check"></i>
                                            Eşleştir
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'matches' && (
                    <div className="space-y-6">
                        {matches.length === 0 ? (
                            <div className="card text-center py-16 animate-fade-in">
                                <i className="fa-solid fa-heart-crack text-6xl text-[var(--matchup-text-muted)] mb-4"></i>
                                <p className="text-[var(--matchup-text-muted)] text-lg">
                                    Henüz eşleşme oluşturulmadı
                                </p>
                            </div>
                        ) : (
                            matches.map((match, index) => (
                                <div
                                    key={match.id}
                                    className="card animate-fade-in"
                                    style={{ animationDelay: `${0.05 * index}s` }}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[var(--matchup-text-muted)] text-sm">
                                            {formatDate(match.created_at)}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteMatch(match.id)}
                                            className="btn-danger text-sm"
                                        >
                                            <i className="fa-solid fa-trash mr-2"></i>Sil
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* Person 1 */}
                                        <div className="flex-1 text-center">
                                            {match.application_1?.photo_url && (
                                                <div
                                                    className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-2 cursor-pointer"
                                                    onClick={() => setSelectedImage(match.application_1.photo_url)}
                                                >
                                                    <img
                                                        src={match.application_1.photo_url}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}
                                            <p className="font-semibold">
                                                {match.application_1?.first_name} {match.application_1?.last_name}
                                            </p>
                                            {match.application_1?.character_name && (
                                                <p className="text-[var(--matchup-primary)] text-sm">
                                                    {match.application_1.character_name}
                                                </p>
                                            )}
                                        </div>

                                        {/* Heart Icon */}
                                        <div className="text-4xl text-[var(--matchup-primary)]">
                                            <i className="fa-solid fa-heart"></i>
                                        </div>

                                        {/* Person 2 */}
                                        <div className="flex-1 text-center">
                                            {match.application_2?.photo_url && (
                                                <div
                                                    className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-2 cursor-pointer"
                                                    onClick={() => setSelectedImage(match.application_2.photo_url)}
                                                >
                                                    <img
                                                        src={match.application_2.photo_url}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}
                                            <p className="font-semibold">
                                                {match.application_2?.first_name} {match.application_2?.last_name}
                                            </p>
                                            {match.application_2?.character_name && (
                                                <p className="text-[var(--matchup-primary)] text-sm">
                                                    {match.application_2.character_name}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Image Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <img
                        src={selectedImage}
                        alt="Full size"
                        className="max-w-full max-h-full rounded-xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button
                        className="absolute top-6 right-6 text-white text-3xl hover:text-[var(--matchup-primary)]"
                        onClick={() => setSelectedImage(null)}
                    >
                        ×
                    </button>
                </div>
            )}
        </main>
    );
}
