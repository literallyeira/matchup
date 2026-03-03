-- İndirim kodu tabloları: admin ekler, kullanıcı bir koddan sadece bir kez yararlanır
-- discount_codes: kod bilgisi (kod, yüzde veya sabit indirim, geçerlilik)
-- discount_redemptions: hangi kullanıcı (application_id) hangi kodu kullandı (bir kez)

CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value INTEGER NOT NULL,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);

CREATE TABLE IF NOT EXISTS discount_redemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(discount_code_id, application_id)
);

CREATE INDEX IF NOT EXISTS idx_discount_redemptions_code ON discount_redemptions(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_app ON discount_redemptions(application_id);

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all discount_codes" ON discount_codes;
DROP POLICY IF EXISTS "Allow all discount_redemptions" ON discount_redemptions;
CREATE POLICY "Allow all discount_codes" ON discount_codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all discount_redemptions" ON discount_redemptions FOR ALL USING (true) WITH CHECK (true);

-- pending_orders'a indirim kodu referansı (ödeme sonrası redemption kaydı için)
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES discount_codes(id) ON DELETE SET NULL;
