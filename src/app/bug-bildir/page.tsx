'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function BugReportPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    emailIc: '',
    discordOoc: '',
    bugDescription: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.emailIc?.trim()) {
      showToast('Email (IC) alanı zorunludur!', 'error');
      return;
    }
    
    if (!formData.bugDescription?.trim()) {
      showToast('Bug açıklaması zorunludur!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailIc: formData.emailIc.trim(),
          discordOoc: formData.discordOoc?.trim() || null,
          bugDescription: formData.bugDescription.trim(),
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        showToast('Bug bildirimi başarıyla gönderildi!', 'success');
        setFormData({ emailIc: '', discordOoc: '', bugDescription: '' });
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        showToast(data.error || 'Bir hata oluştu!', 'error');
      }
    } catch {
      showToast('Bağlantı hatası.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="py-12 px-4 min-h-screen">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <Image src="/matchup_logo.png" alt="MatchUp" width={140} height={40} priority />
          </Link>
          <Link href="/" className="btn-secondary text-sm">
            <i className="fa-solid fa-arrow-left mr-1" /> Ana Sayfa
          </Link>
        </div>

        <div className="card animate-fade-in">
          <h2 className="text-2xl font-bold mb-2">Bug Bildirimi</h2>
          <p className="text-[var(--matchup-text-muted)] text-sm mb-6">
            Karşılaştığınız hataları bildirin, daha iyi bir deneyim için bize yardımcı olun.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="form-label">
                Email (IC) <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                className="form-input"
                placeholder="karakter@email.com"
                value={formData.emailIc}
                onChange={(e) => setFormData({ ...formData, emailIc: e.target.value })}
                required
              />
              <p className="text-xs text-[var(--matchup-text-muted)] mt-1">
                Karakterinizin IC email adresi
              </p>
            </div>

            <div>
              <label className="form-label">
                Discord (OOC) <span className="text-[var(--matchup-text-muted)] font-normal">(isteğe bağlı)</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="KullanıcıAdı#1234"
                value={formData.discordOoc}
                onChange={(e) => setFormData({ ...formData, discordOoc: e.target.value })}
              />
              <p className="text-xs text-[var(--matchup-text-muted)] mt-1">
                Size ulaşabilmemiz için Discord kullanıcı adınız (isteğe bağlı)
              </p>
            </div>

            <div>
              <label className="form-label">
                Bug Açıklaması <span className="text-red-400">*</span>
              </label>
              <textarea
                className="form-input min-h-[150px] resize-none"
                placeholder="Karşılaştığınız hatayı detaylı bir şekilde açıklayın..."
                value={formData.bugDescription}
                onChange={(e) => setFormData({ ...formData, bugDescription: e.target.value })}
                required
              />
              <p className="text-xs text-[var(--matchup-text-muted)] mt-1">
                Mümkünse ekran görüntüsü veya adımları da belirtin
              </p>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Gönderiliyor...
                </span>
              ) : (
                <>
                  <i className="fa-solid fa-bug mr-2" /> Bug Bildir
                </>
              )}
            </button>
          </form>
        </div>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </main>
  );
}
