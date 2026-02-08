# MatchUp - Tinder Tarzı Eşleşme

GTA World karakterleri için Tinder mantığında çöpçatanlık: uyumlu profilleri keşfet, like/dislike at, **karşılıklı like = eşleşme**.

![MatchUp Logo](./public/logo.png)

## 🚀 Hızlı Kurulum

### 1. Supabase Kurulumu

1. [supabase.com](https://supabase.com) adresinden ücretsiz hesap aç
2. Yeni proje oluştur (herhangi bir isim ve şifre ver)
3. Proje açıldıktan sonra **SQL Editor**'a git
4. Aşağıdaki SQL'i çalıştır:

```sql
-- Applications tablosu
CREATE TABLE applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  weight INTEGER NOT NULL,
  sexual_preference TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) aç
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Herkes INSERT yapabilsin (başvuru göndermek için)
CREATE POLICY "Anyone can insert applications" ON applications
FOR INSERT TO anon
WITH CHECK (true);

-- Herkes SELECT yapabilsin (admin paneli için, şifre kontrolü backend'de)
CREATE POLICY "Anyone can view applications" ON applications
FOR SELECT TO anon
USING (true);

-- Herkes DELETE yapabilsin (admin silmesi için, şifre kontrolü backend'de)
CREATE POLICY "Anyone can delete applications" ON applications
FOR DELETE TO anon
USING (true);
```

5. **Storage** bölümüne git
6. **New bucket** → İsim: `photos` → **Public bucket** olarak işaretle → Create
7. Bucket'a tıkla → **Policies** → **New Policy** → "Give users access to their own folder"
   - Veya şu policy'i ekle:

```sql
-- Storage için policy
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "Anyone can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos');
CREATE POLICY "Anyone can delete" ON storage.objects FOR DELETE USING (bucket_id = 'photos');
```

8. **Settings** → **API** bölümünden:
   - `Project URL` → kopyala
   - `anon public` key → kopyala

### 2. Proje Kurulumu

```bash
# Bağımlılıkları yükle
npm install

# .env.local dosyasını düzenle
# Supabase bilgilerini gir
```

`.env.local` dosyası:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ADMIN_PASSWORD=matchup2024
```

### 3. Geliştirme

```bash
npm run dev
```

Site: http://localhost:3000
Admin: http://localhost:3000/admin

---

## 🌐 Vercel'e Deploy

### Yöntem 1: GitHub ile (Önerilen)

1. Projeyi GitHub'a push et
2. [vercel.com](https://vercel.com) → "Add New Project"
3. GitHub reposunu seç
4. **Environment Variables** bölümüne:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ADMIN_PASSWORD`
5. Deploy!

### Yöntem 2: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

Deploy sırasında environment variable'ları eklemen istenecek.

---

## 📁 Proje Yapısı

```
matchup/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Ana sayfa (başvuru formu)
│   │   ├── admin/
│   │   │   └── page.tsx      # Admin paneli
│   │   └── api/
│   │       ├── submit/       # Başvuru gönderme
│   │       ├── applications/ # Başvuruları getir
│   │       └── delete/       # Başvuru sil
│   └── lib/
│       └── supabase.ts       # Supabase client
├── public/
│   └── logo.png              # Logo
└── .env.local                # Environment variables
```

---

## 🔐 Admin Paneli

- URL: `/admin`
- Varsayılan şifre: `matchup2024`
- `.env.local` dosyasından `ADMIN_PASSWORD` ile değiştirebilirsin

---

## 💡 Özellikler

- ✅ **Keşfet**: Cinsiyet/yönelime göre uyumlu profiller tek tek kart olarak gösterilir
- ✅ **Like / Dislike**: Beğenmediğin profiller bir daha gösterilmez; beğenirsen like atılır
- ✅ **Eşleşme**: İki taraf da birbirine like attığında otomatik eşleşme oluşur
- ✅ **Eşleşmelerim**: Karşılıklı eşleştiğin kişileri görüntüle, iletişim bilgilerine eriş, istersen eşleşmeyi kaldır
- ✅ Profil oluşturma/düzenleme (fotoğraf linki, yaş, cinsiyet, yönelim, telefon, Facebrowser, açıklama)
- ✅ Admin paneli: Profilleri ve eşleşmeleri listeleme/silme (eşleşme artık sadece karşılıklı like ile oluşur)
- ✅ Vercel uyumlu, Supabase ücretsiz tier

### Tinder migration (likes / dislikes)

Mevcut projede Tinder mantığına geçmek için Supabase SQL Editor'da **`supabase_tinder_migration.sql`** dosyasını çalıştır. Bu dosya `likes` ve `dislikes` tablolarını ekler; eşleşmeler artık yalnızca karşılıklı like ile oluşturulur.

### Test için verileri sıfırlama

Like, dislike ve eşleşmeleri temizleyip baştan denemek için Supabase SQL Editor'da **`supabase_reset_likes_matches.sql`** dosyasını çalıştır. `likes`, `dislikes`, `matches` ve `rejected_matches` tabloları boşaltılır.

---

## 📞 Destek

Herhangi bir sorun olursa issue aç!
