-- MatchUp GTAW OAuth Migration
-- Bu SQL'i Supabase SQL Editor'da çalıştır

-- 1. Applications tablosuna yeni sütunlar ekle
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS gtaw_user_id INTEGER,
ADD COLUMN IF NOT EXISTS character_id INTEGER,
ADD COLUMN IF NOT EXISTS character_name TEXT;

-- 2. Matches tablosu oluştur
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_1_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  application_2_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  UNIQUE(application_1_id, application_2_id)
);

-- 3. Index'ler (performans için)
CREATE INDEX IF NOT EXISTS idx_applications_gtaw_user ON applications(gtaw_user_id);
CREATE INDEX IF NOT EXISTS idx_applications_character ON applications(character_id);
CREATE INDEX IF NOT EXISTS idx_matches_app1 ON matches(application_1_id);
CREATE INDEX IF NOT EXISTS idx_matches_app2 ON matches(application_2_id);

-- 4. RLS (Row Level Security) - matches tablosu için
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (kullanıcılar kendi eşleşmelerini görmeli)
CREATE POLICY "Allow read access to matches" ON matches
  FOR SELECT USING (true);

-- Sadece authenticated kullanıcılar insert/update/delete yapabilir
-- Not: Admin kontrolü API katmanında yapılıyor
CREATE POLICY "Allow all access to matches" ON matches
  FOR ALL USING (true);
