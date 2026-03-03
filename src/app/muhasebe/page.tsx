'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';

interface PaymentStats {
  total: number;
  lastWeek: number;
  fromSubscriptions: number;
  fromBoost: number;
  fromAds: number;
  byProduct?: Record<string, number>;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  created_at: string;
}

export default function MuhasebePage() {
  const { data: session, status } = useSession();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [income, setIncome] = useState<PaymentStats | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getAuth = () => password || (typeof window !== 'undefined' ? localStorage.getItem('adminPassword') : null) || '';

  const loadData = async (pwd?: string) => {
    const auth = pwd ?? getAuth();
    if (!auth) return;
    setLoadingData(true);
    try {
      const [statsRes, expensesRes] = await Promise.all([
        fetch('/api/admin/payments-stats', { headers: { Authorization: auth } }),
        fetch('/api/admin/expenses', { headers: { Authorization: auth } }),
      ]);
      if (statsRes.ok) {
        const data = await statsRes.json();
        setIncome(data);
      }
      if (expensesRes.ok) {
        const data = await expensesRes.json();
        setExpenses(Array.isArray(data) ? data : []);
      }
    } catch {
      setIncome(null);
      setExpenses([]);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('adminPassword') : null;
    const ucp = (session?.user as any)?.username || (session?.user as any)?.name;
    if (saved && ucp) {
      setPassword(saved);
      setIsAuthenticated(true);
      loadData(saved);
    } else if (saved) setPassword(saved);
  }, [session?.user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const ucp = (session?.user as any)?.username || (session?.user as any)?.name;
    if (!ucp) {
      setError('Muhasebe için önce UCP ile giriş yapın.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/payments-stats', {
        headers: { Authorization: password },
      });
      if (res.ok) {
        setIsAuthenticated(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('adminPassword', password);
          localStorage.setItem('adminUcpName', ucp);
        }
        loadData();
      } else {
        setError('Yanlış şifre.');
      }
    } catch {
      setError('Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const desc = newDesc.trim();
    const amount = Math.abs(Number(newAmount) || 0);
    if (!desc) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: getAuth() },
        body: JSON.stringify({ description: desc, amount, expense_date: newDate }),
      });
      if (res.ok) {
        setNewDesc('');
        setNewAmount('');
        setNewDate(new Date().toISOString().slice(0, 10));
        loadData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Bu gideri silmek istediğinize emin misiniz?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/expenses?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: getAuth() },
      });
      if (res.ok) loadData();
    } finally {
      setDeletingId(null);
    }
  };

  const hasUcp = !!(session?.user && ((session.user as any).username || (session.user as any).name));
  const totalGider = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const toplamGelir = income?.total ?? 0;
  const bakiye = toplamGelir - totalGider;

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </main>
    );
  }

  if (!hasUcp) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <Image src="/matchup_logo.png" alt="MatchUp" width={160} height={44} className="mx-auto mb-6" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Muhasebe</h1>
          <p className="text-gray-600 mb-6">Bu sayfa için UCP ile giriş yapmanız gerekiyor.</p>
          <button onClick={() => signIn('gtaw')} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700">
            UCP ile Giriş Yap
          </button>
          <Link href="/" className="block mt-4 text-gray-500 hover:text-gray-700 text-sm">← Ana Sayfa</Link>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-md w-full">
          <Image src="/matchup_logo.png" alt="MatchUp" width={160} height={44} className="mx-auto mb-6" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Muhasebe</h1>
          <p className="text-gray-600 mb-6">Merhaba, <span className="font-medium text-gray-900">{(session!.user as any).username || (session!.user as any).name}</span></p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin şifresi</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Kontrol ediliyor...' : 'Giriş Yap'}
            </button>
          </form>
          <Link href="/" className="block mt-4 text-center text-gray-500 hover:text-gray-700 text-sm">← Ana Sayfa</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Muhasebe</h1>
            <p className="text-gray-600 text-sm mt-1">Gelir ve gider takibi</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">Admin Panel</Link>
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">Ana Sayfa</Link>
          </div>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Özet kartlar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Toplam Gelir</p>
                <p className="text-2xl font-bold text-green-600 mt-1">${(toplamGelir || 0).toLocaleString('tr-TR')}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Toplam Gider</p>
                <p className="text-2xl font-bold text-red-600 mt-1">${totalGider.toLocaleString('tr-TR')}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Bakiye</p>
                <p className={`text-2xl font-bold mt-1 ${bakiye >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                  ${bakiye.toLocaleString('tr-TR')}
                </p>
              </div>
            </div>

            {/* Gelir detay */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Gelir (ödemeler)</h2>
              {income?.byProduct && (
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between"><span className="text-gray-600">Plus abonelik</span> <span className="font-medium">${(income.byProduct.plus || 0).toLocaleString('tr-TR')}</span></li>
                  <li className="flex justify-between"><span className="text-gray-600">Pro abonelik</span> <span className="font-medium">${(income.byProduct.pro || 0).toLocaleString('tr-TR')}</span></li>
                  <li className="flex justify-between"><span className="text-gray-600">Boost</span> <span className="font-medium">${(income.byProduct.boost || 0).toLocaleString('tr-TR')}</span></li>
                  <li className="flex justify-between"><span className="text-gray-600">Reklam (sol/sağ)</span> <span className="font-medium">${((income.byProduct.ad_left || 0) + (income.byProduct.ad_right || 0)).toLocaleString('tr-TR')}</span></li>
                </ul>
              )}
              {!income?.byProduct && <p className="text-gray-500 text-sm">Gelir verisi yok</p>}
            </section>

            {/* Gider ekle */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Gider Ekle</h2>
              <form onSubmit={handleAddExpense} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Örn: Maaş ödemesi, Ofis kirası"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
                <input
                  type="number"
                  min="0"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="Tutar ($)"
                  className="w-full sm:w-32 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full sm:w-40 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button type="submit" disabled={submitting} className="py-2.5 px-6 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap">
                  {submitting ? 'Ekleniyor...' : 'Ekle'}
                </button>
              </form>
            </section>

            {/* Gider listesi */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Giderler</h2>
              {expenses.length === 0 ? (
                <p className="text-gray-500 text-sm">Henüz gider eklenmedi.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500 font-medium">
                        <th className="pb-3 pr-4">Tarih</th>
                        <th className="pb-3 pr-4">Açıklama</th>
                        <th className="pb-3 pr-4 text-right">Tutar</th>
                        <th className="pb-3 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((e) => (
                        <tr key={e.id} className="border-b border-gray-100">
                          <td className="py-3 pr-4 text-gray-600">{new Date(e.expense_date).toLocaleDateString('tr-TR')}</td>
                          <td className="py-3 pr-4">{e.description}</td>
                          <td className="py-3 pr-4 text-right font-medium text-red-600">${(e.amount || 0).toLocaleString('tr-TR')}</td>
                          <td className="py-3">
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(e.id)}
                              disabled={deletingId === e.id}
                              className="text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-50"
                            >
                              {deletingId === e.id ? '...' : 'Sil'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
