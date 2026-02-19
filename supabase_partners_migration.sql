-- Partners Migration
-- Bu SQL'i Supabase SQL Editor'da çalıştır

CREATE TABLE IF NOT EXISTS partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  link_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partners_sort ON partners(sort_order);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to partners" ON partners;
CREATE POLICY "Allow all access to partners" ON partners FOR ALL USING (true) WITH CHECK (true);
