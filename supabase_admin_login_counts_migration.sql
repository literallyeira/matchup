-- Admin login counts (aggregated giriş sayıları)
-- Bu SQL'i Supabase SQL Editor'da çalıştır

CREATE TABLE IF NOT EXISTS admin_login_counts (
  admin_name TEXT PRIMARY KEY,
  login_count INTEGER NOT NULL DEFAULT 0,
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE admin_login_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to admin_login_counts" ON admin_login_counts;
CREATE POLICY "Allow all access to admin_login_counts" ON admin_login_counts FOR ALL USING (true) WITH CHECK (true);
