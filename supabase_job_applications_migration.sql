-- Job Applications Migration
-- Bu SQL'i Supabase SQL Editor'da çalıştır

CREATE TABLE IF NOT EXISTS job_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  character_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  address TEXT NOT NULL,
  background TEXT NOT NULL,
  education TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected'))
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_job_applications_created_at ON job_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);

-- RLS: Tüm erişim izni (Geliştirme kolaylığı için)
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to job_applications" ON job_applications;
CREATE POLICY "Allow all access to job_applications" ON job_applications FOR ALL USING (true) WITH CHECK (true);
