-- Bug Reports Migration
-- Bu SQL'i Supabase SQL Editor'da çalıştır

CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_ic TEXT NOT NULL,
  discord_ooc TEXT,
  bug_description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'fixed', 'rejected'))
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);

-- RLS: Tüm erişim izni (Geliştirme kolaylığı için)
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to bug_reports" ON bug_reports;
CREATE POLICY "Allow all access to bug_reports" ON bug_reports FOR ALL USING (true) WITH CHECK (true);
