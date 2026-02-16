import { supabase } from './supabase';
import { extendOrSetSubscription } from './limits';

const REFERRAL_REWARD_COUNT = 20;
const PRO_REWARD_DAYS = 365;

function generateRefCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/** Kullanıcının referans kodunu al veya oluştur */
export async function getOrCreateRefCode(gtawUserId: number): Promise<string> {
  const { data: existing } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('gtaw_user_id', gtawUserId)
    .single();

  if (existing?.code) return existing.code;

  let code = generateRefCode();
  let attempts = 0;
  while (attempts < 10) {
    const { error } = await supabase
      .from('referral_codes')
      .upsert({ gtaw_user_id: gtawUserId, code }, { onConflict: 'gtaw_user_id' });

    if (!error) {
      const { data } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('gtaw_user_id', gtawUserId)
        .single();
      return data?.code || code;
    }
    if (error.code === '23505') {
      code = generateRefCode();
      attempts++;
      continue;
    }
    throw error;
  }
  return code;
}

/** Ref kodundan referrer'ın gtaw_user_id'sini bul */
export async function getReferrerByCode(refCode: string): Promise<number | null> {
  const { data } = await supabase
    .from('referral_codes')
    .select('gtaw_user_id')
    .eq('code', refCode)
    .single();
  return data?.gtaw_user_id ?? null;
}

/** Kullanıcının önceden application'ı var mı? (yeni kullanıcı kontrolü) */
export async function hasPriorApplication(gtawUserId: number): Promise<boolean> {
  const { count } = await supabase
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('gtaw_user_id', gtawUserId);
  return (count ?? 0) > 0;
}

/** Referral kaydı ekle (sadece yeni kullanıcı için). Referrer'a 20 davet = Pro ver */
export async function recordReferralAndMaybeGrantPro(
  referrerGtawUserId: number,
  referredGtawUserId: number,
  referredApplicationId: string
): Promise<void> {
  if (referrerGtawUserId === referredGtawUserId) return; // kendine referans yok

  const { error: insertError } = await supabase
    .from('referrals')
    .insert({
      referrer_gtaw_user_id: referrerGtawUserId,
      referred_gtaw_user_id: referredGtawUserId,
      referred_application_id: referredApplicationId,
    });

  if (insertError) {
    if (insertError.code === '23505') return; // zaten kayıtlı (unique constraint)
    throw insertError;
  }

  // Referrer'ın benzersiz davet sayısı
  const { count } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_gtaw_user_id', referrerGtawUserId);

  if (count !== REFERRAL_REWARD_COUNT) return;

  // 20. davet: Pro ver
  const { data: firstApp } = await supabase
    .from('applications')
    .select('id')
    .eq('gtaw_user_id', referrerGtawUserId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (firstApp?.id) {
    await extendOrSetSubscription(firstApp.id, 'pro', PRO_REWARD_DAYS);
  }
}
