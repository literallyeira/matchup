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
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'applications' | 'matches' | 'subscriptions' | 'payments'>('applications');
    const [subModal, setSubModal] = useState<{ appId: string; name: string; currentTier: string } | null>(null);
    const [subTier, setSubTier] = useState('free');
    const [subDays, setSubDays] = useState(7);
    const [subLoading, setSubLoading] = useState(false);
    const [appSubs, setAppSubs] = useState<Record<string, { tier: string; expiresAt: string | null }>>({});
    const [activeSubs, setActiveSubs] = useState<Array<{ application_id: string; tier: string; expires_at: string; first_name?: string; last_name?: string; character_name?: string }>>([]);
    const [paymentsList, setPaymentsList] = useState<Array<{ id: string; application_id: string; product: string; amount: number; created_at?: string; first_name?: string; last_name?: string; character_name?: string }>>([]);
    const [loadingSubs, setLoadingSubs] = useState(false);
    const [loadingPayments, setLoadingPayments] = useState(false);

    // Filters
    const [filterGender, setFilterGender] = useState('');
    const [filterPreference, setFilterPreference] = useState('');

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

    const fetchSubscription = async (appId: string) => {
        try {
            const res = await fetch(`/api/admin/subscription?applicationId=${appId}`, {
                headers: { Authorization: password || localStorage.getItem('adminPassword') || '' },
            });
            if (res.ok) {
                const data = await res.json();
                setAppSubs(prev => ({ ...prev, [appId]: { tier: data.tier, expiresAt: data.expiresAt } }));
            }
        } catch { /* ignore */ }
    };

    const fetchAllSubscriptions = async () => {
        const pwd = password || localStorage.getItem('adminPassword') || '';
        for (const app of applications) {
            try {
                const res = await fetch(`/api/admin/subscription?applicationId=${app.id}`, {
                    headers: { Authorization: pwd },
                });
                if (res.ok) {
                    const data = await res.json();
                    setAppSubs(prev => ({ ...prev, [app.id]: { tier: data.tier, expiresAt: data.expiresAt } }));
                }
            } catch { /* ignore */ }
        }
    };

    const fetchActiveSubscriptionsList = async () => {
        setLoadingSubs(true);
        try {
            const res = await fetch('/api/admin/subscriptions-list', {
                headers: { Authorization: password || localStorage.getItem('adminPassword') || '' },
            });
            if (res.ok) {
                const data = await res.json();
                setActiveSubs(Array.isArray(data) ? data : []);
            } else setActiveSubs([]);
        } catch { setActiveSubs([]); }
        finally { setLoadingSubs(false); }
    };

    const fetchPaymentsList = async () => {
        setLoadingPayments(true);
        try {
            const res = await fetch('/api/admin/payments-list', {
                headers: { Authorization: password || localStorage.getItem('adminPassword') || '' },
            });
            if (res.ok) {
                const data = await res.json();
                setPaymentsList(Array.isArray(data) ? data : []);
            } else setPaymentsList([]);
        } catch { setPaymentsList([]); }
        finally { setLoadingPayments(false); }
    };

    const handleSubChange = async () => {
        if (!subModal) return;
        setSubLoading(true);
        try {
            const res = await fetch('/api/admin/subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: password || localStorage.getItem('adminPassword') || '',
                },
                body: JSON.stringify({ applicationId: subModal.appId, tier: subTier, durationDays: subDays }),
            });
            if (res.ok) {
                const data = await res.json();
                setAppSubs(prev => ({ ...prev, [subModal.appId]: { tier: data.tier, expiresAt: data.expiresAt || null } }));
                setSubModal(null);
            }
        } catch { /* ignore */ }
        setSubLoading(false);
    };

    // Uygulamalar yüklenince üyelikleri getir
    useEffect(() => {
        if (applications.length > 0 && isAuthenticated) fetchAllSubscriptions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applications.length, isAuthenticated]);

    useEffect(() => {
        if (activeTab === 'subscriptions' && isAuthenticated) fetchActiveSubscriptionsList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, isAuthenticated]);

    useEffect(() => {
        if (activeTab === 'payments' && isAuthenticated) fetchPaymentsList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, isAuthenticated]);

    const getSubLabel = (tier: string) => {
        if (tier === 'plus') return 'MatchUp+';
        if (tier === 'pro') return 'MatchUp Pro';
        return 'Ücretsiz';
    };

    const getSubColor = (tier: string) => {
        if (tier === 'plus') return 'text-pink-400';
        if (tier === 'pro') return 'text-violet-400';
        return 'text-[var(--matchup-text-muted)]';
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setPassword('');
        setApplications([]);
        setMatches([]);
        localStorage.removeItem('adminPassword');
    };

    useEffect(() => {
        const savedPassword = localStorage.getItem('adminPassword');
        if (savedPassword) {
            setPassword(savedPassword);
            setIsAuthenticated(true);
            fetchApplications(savedPassword);
            fetchMatches(savedPassword);
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
                        <i className="fa-solid fa-users mr-2"></i>Profiller ({applications.length})
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
                    <button
                        onClick={() => setActiveTab('subscriptions')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'subscriptions'
                            ? 'bg-[var(--matchup-primary)] text-white'
                            : 'bg-[var(--matchup-bg-card)] hover:bg-[var(--matchup-bg-input)]'
                            }`}
                    >
                        <i className="fa-solid fa-crown mr-2"></i>Aktif Üyelikler
                    </button>
                    <button
                        onClick={() => setActiveTab('payments')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'payments'
                            ? 'bg-[var(--matchup-primary)] text-white'
                            : 'bg-[var(--matchup-bg-card)] hover:bg-[var(--matchup-bg-input)]'
                            }`}
                    >
                        <i className="fa-solid fa-receipt mr-2"></i>Ödemeler
                    </button>
                </div>

                {activeTab === 'applications' && (
                    <>
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
                                    const appMatches = getMatchesForApp(app.id);

                                    return (
                                        <div
                                            key={app.id}
                                            className="card animate-fade-in transition-all"
                                            style={{ animationDelay: `${0.05 * index}s` }}
                                        >
                                            <div className="flex flex-col md:flex-row gap-6">
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
                                                        <div className="flex items-center gap-2">
                                                            {/* Üyelik Badge */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const sub = appSubs[app.id];
                                                                    setSubTier(sub?.tier || 'free');
                                                                    setSubDays(7);
                                                                    setSubModal({ appId: app.id, name: `${app.first_name} ${app.last_name}`, currentTier: sub?.tier || 'free' });
                                                                }}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:opacity-80 ${
                                                                    appSubs[app.id]?.tier === 'pro' ? 'border-violet-500/40 bg-violet-500/15 text-violet-400' :
                                                                    appSubs[app.id]?.tier === 'plus' ? 'border-pink-500/40 bg-pink-500/15 text-pink-400' :
                                                                    'border-[var(--matchup-border)] bg-[var(--matchup-bg-input)] text-[var(--matchup-text-muted)]'
                                                                }`}
                                                            >
                                                                <i className={`fa-solid ${appSubs[app.id]?.tier === 'pro' ? 'fa-crown' : appSubs[app.id]?.tier === 'plus' ? 'fa-star' : 'fa-user'} mr-1`} />
                                                                {getSubLabel(appSubs[app.id]?.tier || 'free')}
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDelete(app.id); }}
                                                                className="btn-danger"
                                                            >
                                                                <i className="fa-solid fa-trash mr-2"></i>Sil
                                                            </button>
                                                        </div>
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

                {activeTab === 'matches' && (
                    <div className="space-y-6">
                        {matches.length === 0 ? (
                            <div className="card text-center py-16 animate-fade-in">
                                <i className="fa-solid fa-heart-crack text-6xl text-[var(--matchup-text-muted)] mb-4"></i>
                                <p className="text-[var(--matchup-text-muted)] text-lg">
                                    Henüz karşılıklı like ile eşleşme yok
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

                {activeTab === 'subscriptions' && (
                    <div className="space-y-6">
                        <div className="card animate-fade-in">
                            <h2 className="text-lg font-semibold mb-4"><i className="fa-solid fa-crown mr-2 text-violet-400"></i>Aktif Üyelikler</h2>
                            <p className="text-[var(--matchup-text-muted)] text-sm mb-4">Süresi dolmamış abonelikler (Plus / Pro).</p>
                            {loadingSubs ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin w-10 h-10 border-4 border-[var(--matchup-primary)] border-t-transparent rounded-full" />
                                </div>
                            ) : activeSubs.length === 0 ? (
                                <p className="text-[var(--matchup-text-muted)] py-8 text-center">Aktif üyelik yok.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="border-b border-[var(--matchup-border)]">
                                                <th className="pb-3 pr-4 font-semibold">Profil</th>
                                                <th className="pb-3 pr-4 font-semibold">Karakter</th>
                                                <th className="pb-3 pr-4 font-semibold">Tier</th>
                                                <th className="pb-3 pr-4 font-semibold">Bitiş</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeSubs.map((s) => (
                                                <tr key={s.application_id} className="border-b border-[var(--matchup-border)]/50">
                                                    <td className="py-3 pr-4">{s.first_name} {s.last_name}</td>
                                                    <td className="py-3 pr-4 text-[var(--matchup-primary)]">{s.character_name || '-'}</td>
                                                    <td className="py-3 pr-4">
                                                        <span className={s.tier === 'pro' ? 'text-violet-400' : 'text-pink-400'}>
                                                            {getSubLabel(s.tier)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 pr-4 text-[var(--matchup-text-muted)]">{formatDate(s.expires_at)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'payments' && (
                    <div className="space-y-6">
                        <div className="card animate-fade-in">
                            <h2 className="text-lg font-semibold mb-4"><i className="fa-solid fa-receipt mr-2 text-[var(--matchup-primary)]"></i>Ödemeler</h2>
                            <p className="text-[var(--matchup-text-muted)] text-sm mb-4">Tüm tamamlanan ödemeler (geçmiş).</p>
                            {loadingPayments ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin w-10 h-10 border-4 border-[var(--matchup-primary)] border-t-transparent rounded-full" />
                                </div>
                            ) : paymentsList.length === 0 ? (
                                <p className="text-[var(--matchup-text-muted)] py-8 text-center">Henüz ödeme kaydı yok.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="border-b border-[var(--matchup-border)]">
                                                <th className="pb-3 pr-4 font-semibold">Tarih</th>
                                                <th className="pb-3 pr-4 font-semibold">Profil</th>
                                                <th className="pb-3 pr-4 font-semibold">Karakter</th>
                                                <th className="pb-3 pr-4 font-semibold">Ürün</th>
                                                <th className="pb-3 pr-4 font-semibold">Tutar</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paymentsList.map((p) => (
                                                <tr key={p.id} className="border-b border-[var(--matchup-border)]/50">
                                                    <td className="py-3 pr-4 text-[var(--matchup-text-muted)]">{p.created_at ? formatDate(p.created_at) : '-'}</td>
                                                    <td className="py-3 pr-4">{p.first_name} {p.last_name}</td>
                                                    <td className="py-3 pr-4 text-[var(--matchup-primary)]">{p.character_name || '-'}</td>
                                                    <td className="py-3 pr-4">{p.product === 'pro' ? 'MatchUp Pro' : p.product === 'plus' ? 'MatchUp+' : p.product === 'boost' ? 'Boost' : p.product}</td>
                                                    <td className="py-3 pr-4 font-semibold text-[var(--matchup-primary)]">₺{p.amount}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Subscription Modal */}
            {subModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSubModal(null)}>
                    <div className="card max-w-sm w-full animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-1">Üyelik Değiştir</h3>
                        <p className="text-[var(--matchup-text-muted)] text-sm mb-4">{subModal.name}</p>
                        <p className="text-xs text-[var(--matchup-text-muted)] mb-4">Mevcut: <span className={getSubColor(subModal.currentTier)}>{getSubLabel(subModal.currentTier)}</span></p>

                        <div className="space-y-4">
                            <div>
                                <label className="form-label">Tier</label>
                                <select className="form-input" value={subTier} onChange={(e) => setSubTier(e.target.value)}>
                                    <option value="free">Ücretsiz</option>
                                    <option value="plus">MatchUp+</option>
                                    <option value="pro">MatchUp Pro</option>
                                </select>
                            </div>
                            {subTier !== 'free' && (
                                <div>
                                    <label className="form-label">Süre (gün)</label>
                                    <input type="number" className="form-input" min={1} max={365} value={subDays} onChange={(e) => setSubDays(Number(e.target.value))} />
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button onClick={handleSubChange} disabled={subLoading} className="btn-primary flex-1 py-2.5">
                                    {subLoading ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                                <button onClick={() => setSubModal(null)} className="btn-secondary flex-1 py-2.5">İptal</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
