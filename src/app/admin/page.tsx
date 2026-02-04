'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Application } from '@/lib/supabase';

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [applications, setApplications] = useState<Application[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Filters
    const [filterGender, setFilterGender] = useState('');
    const [filterPreference, setFilterPreference] = useState('');

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
                    'Authorization': savedPassword || password
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

    const handleDelete = async (id: string) => {
        if (!confirm('Bu başvuruyu silmek istediğinize emin misiniz?')) return;

        try {
            const response = await fetch('/api/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': password || localStorage.getItem('adminPassword') || ''
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

    const handleLogout = () => {
        setIsAuthenticated(false);
        setPassword('');
        setApplications([]);
        localStorage.removeItem('adminPassword');
    };

    useEffect(() => {
        const savedPassword = localStorage.getItem('adminPassword');
        if (savedPassword) {
            setPassword(savedPassword);
            setIsAuthenticated(true);
            fetchApplications(savedPassword);
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

    // Login Screen
    if (!isAuthenticated) {
        return (
            <main className="min-h-screen flex items-center justify-center px-4">
                <div className="card max-w-md w-full animate-fade-in">
                    <div className="text-center mb-8">
                        <Image
                            src="/logo.png"
                            alt="MatchUp Logo"
                            width={180}
                            height={50}
                            className="mx-auto mb-4"
                            priority
                        />
                        <h1 className="text-2xl font-bold">Admin Paneli</h1>
                        <p className="text-[var(--matchup-text-muted)] mt-2">Giriş yapmak için şifrenizi girin</p>
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
        <main className="min-h-screen py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 animate-fade-in">
                    <div className="flex items-center gap-4">
                        <Image
                            src="/logo.png"
                            alt="MatchUp Logo"
                            width={140}
                            height={40}
                            priority
                        />
                        <span className="text-[var(--matchup-text-muted)]">Admin Paneli</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => fetchApplications()}
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
                                <option value="diger">Diğer</option>
                            </select>
                        </div>
                        <div>
                            <label className="form-label text-sm">Cinsel Tercih</label>
                            <select
                                className="form-input"
                                value={filterPreference}
                                onChange={(e) => setFilterPreference(e.target.value)}
                            >
                                <option value="">Tümü</option>
                                <option value="heteroseksuel">Heteroseksüel</option>
                                <option value="homoseksuel">Homoseksüel</option>
                                <option value="biseksuel">Biseksüel</option>
                                <option value="diger">Diğer</option>
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
                        {filteredApplications.map((app, index) => (
                            <div
                                key={app.id}
                                className="card animate-fade-in"
                                style={{ animationDelay: `${0.05 * index}s` }}
                            >
                                <div className="flex flex-col md:flex-row gap-6">
                                    {/* Photo */}
                                    <div
                                        className="w-32 h-32 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer bg-[var(--matchup-bg-input)]"
                                        onClick={() => app.photo_url && setSelectedImage(app.photo_url)}
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
                                                <p className="text-[var(--matchup-text-muted)] text-sm">
                                                    {formatDate(app.created_at)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(app.id)}
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
                                                <span className="text-[var(--matchup-text-muted)] text-sm">Kilo</span>
                                                <p className="font-semibold">{app.weight} kg</p>
                                            </div>
                                            <div>
                                                <span className="text-[var(--matchup-text-muted)] text-sm">Cinsiyet</span>
                                                <p className="font-semibold">{getGenderLabel(app.gender)}</p>
                                            </div>
                                            <div>
                                                <span className="text-[var(--matchup-text-muted)] text-sm">Tercih</span>
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
                                    </div>
                                </div>
                            </div>
                        ))}
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
