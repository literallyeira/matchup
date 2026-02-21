-- Günlük çevrimiçi istatistikleri (rekor için)
-- Bu SQL'i Supabase SQL Editor'da çalıştır

CREATE TABLE IF NOT EXISTS daily_active_stats (
  stat_date DATE PRIMARY KEY,
  active_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE daily_active_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to daily_active_stats" ON daily_active_stats;
CREATE POLICY "Allow all access to daily_active_stats" ON daily_active_stats FOR ALL USING (true) WITH CHECK (true);
