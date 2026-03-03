import { supabase } from '@/lib/supabase';

const PRODUCT_BASE_PRICES: Record<string, number> = {
  plus: 5000,
  pro: 15000,
  boost: 5000,
  ad_left: 25000,
  ad_right: 25000,
};

export type DiscountResult =
  | { valid: true; finalPrice: number; discountAmount: number; discountCodeId: string }
  | { valid: false; error: string };

export async function validateDiscountCode(
  code: string,
  product: string,
  applicationId: string
): Promise<DiscountResult> {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) {
    return { valid: false, error: 'Kod girin' };
  }

  const basePrice = PRODUCT_BASE_PRICES[product];
  if (basePrice == null) {
    return { valid: false, error: 'Geçersiz ürün' };
  }

  const { data: row, error: fetchError } = await supabase
    .from('discount_codes')
    .select('id, code, discount_type, discount_value, valid_from, valid_until')
    .ilike('code', normalized)
    .maybeSingle();

  if (fetchError || !row) {
    return { valid: false, error: 'Geçersiz veya süresi dolmuş indirim kodu' };
  }

  const now = new Date();
  if (row.valid_from && new Date(row.valid_from) > now) {
    return { valid: false, error: 'Bu kod henüz geçerli değil' };
  }
  if (row.valid_until && new Date(row.valid_until) < now) {
    return { valid: false, error: 'İndirim kodunun süresi dolmuş' };
  }

  const { data: used } = await supabase
    .from('discount_redemptions')
    .select('id')
    .eq('discount_code_id', row.id)
    .eq('application_id', applicationId)
    .maybeSingle();

  if (used) {
    return { valid: false, error: 'Bu kodu daha önce kullandınız' };
  }

  let discountAmount = 0;
  if (row.discount_type === 'percent') {
    const pct = Math.min(100, Math.max(0, Number(row.discount_value) || 0));
    discountAmount = Math.round((basePrice * pct) / 100);
  } else {
    discountAmount = Math.min(basePrice, Math.max(0, Number(row.discount_value) || 0));
  }

  const finalPrice = Math.max(0, basePrice - discountAmount);

  return {
    valid: true,
    finalPrice,
    discountAmount,
    discountCodeId: row.id,
  };
}

export function getBasePrice(product: string): number {
  return PRODUCT_BASE_PRICES[product] ?? 0;
}
