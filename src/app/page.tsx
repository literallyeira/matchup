'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function Home() {
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

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.photoUrl) {
      showToast('Lütfen bir fotoğraf linki girin!', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
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
      } else {
        showToast(result.error || 'Bir hata oluştu!', 'error');
      }
    } catch {
      showToast('Bağlantı hatası! Lütfen tekrar deneyin.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Logo */}
        <div className="text-center mb-10 animate-fade-in">
          <Image
            src="/logo.png"
            alt="MatchUp Logo"
            width={220}
            height={60}
            className="mx-auto mb-4"
            priority
          />
          <p className="text-[var(--matchup-text-muted)] text-lg">
            <i className="fa-solid fa-heart text-[var(--matchup-primary)] mr-2"></i>
            Hayatının aşkını bulmaya bir adım kaldı!
          </p>
        </div>

        {/* Form Card */}
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
