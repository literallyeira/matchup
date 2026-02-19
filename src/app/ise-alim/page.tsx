'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function JobApplicationPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    characterName: '',
    phoneNumber: '',
    address: '',
    background: '',
    education: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.characterName?.trim()) {
      showToast('Karakter adı zorunludur!', 'error');
      return;
    }
    
    if (!formData.phoneNumber?.trim()) {
      showToast('Telefon numarası zorunludur!', 'error');
      return;
    }
    
    if (!formData.address?.trim()) {
      showToast('Adres zorunludur!', 'error');
      return;
    }
    
    if (!formData.background?.trim()) {
      showToast('Geçmiş bilgisi zorunludur!', 'error');
      return;
    }
    
    if (!formData.education?.trim()) {
      showToast('Eğitim durumu zorunludur!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/job-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterName: formData.characterName.trim(),
          phoneNumber: formData.phoneNumber.trim(),
          address: formData.address.trim(),
          background: formData.background.trim(),
          education: formData.education.trim(),
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        showToast('İşe alım başvurunuz başarıyla gönderildi!', 'success');
        setFormData({ characterName: '', phoneNumber: '', address: '', background: '', education: '' });
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
          <h2 className="text-2xl font-bold mb-2">İşe Alım Başvurusu</h2>
          <p className="text-[var(--matchup-text-muted)] text-sm mb-6">
            MatchUp ekibine katılmak için başvuru formunu doldurun.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="form-label">
                Karakter Adı <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Ad Soyad"
                value={formData.characterName}
                onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label">
                Telefon Numarası <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                className="form-input"
                placeholder="555-1234"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label">
                Adres <span className="text-red-400">*</span>
              </label>
              <textarea
                className="form-input min-h-[100px] resize-none"
                placeholder="Karakterinizin ikamet adresi..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label">
                Geçmiş <span className="text-red-400">*</span>
              </label>
              <textarea
                className="form-input min-h-[120px] resize-none"
                placeholder="Karakterinizin geçmişi, deneyimleri, yetenekleri..."
                value={formData.background}
                onChange={(e) => setFormData({ ...formData, background: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label">
                Eğitim Durumu <span className="text-red-400">*</span>
              </label>
              <textarea
                className="form-input min-h-[100px] resize-none"
                placeholder="Karakterinizin eğitim durumu, mezun olduğu okullar..."
                value={formData.education}
                onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                required
              />
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
                  <i className="fa-solid fa-briefcase mr-2" /> Başvuruyu Gönder
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
