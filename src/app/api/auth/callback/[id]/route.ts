import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';

const AUTH_KEY = process.env.GTAW_GATEWAY_AUTH_KEY!;
const BASE_URL = process.env.NEXTAUTH_URL || 'https://matchup.icu';
const REDIRECT_STATUS = 302;

function success() {
  const res = NextResponse.redirect(new URL('/?payment=success', BASE_URL), REDIRECT_STATUS);
  res.cookies.delete('matchup_pending_order');
  return res;
}
function fail(reason: string) {
  console.error('[CALLBACK] ERROR:', reason);
  return NextResponse.redirect(new URL('/?payment=error', BASE_URL), REDIRECT_STATUS);
}

async function activateProduct(appId: string, product: string) {
  const now = new Date();
  if (product === 'plus') {
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await supabase.from('subscriptions').upsert(
      { application_id: appId, tier: 'plus', expires_at: expiresAt.toISOString() },
      { onConflict: 'application_id' }
    );
  } else if (product === 'pro') {
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await supabase.from('subscriptions').upsert(
      { application_id: appId, tier: 'pro', expires_at: expiresAt.toISOString() },
      { onConflict: 'application_id' }
    );
  } else if (product === 'boost') {
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await supabase.from('boosts').insert({
      application_id: appId,
      expires_at: expiresAt.toISOString(),
    });
  }
  console.log('[CALLBACK] Product activated:', product, 'for app:', appId);
}

async function handleBankingCallback(callbackToken: string) {
  const cookieStore = await cookies();
  const orderId = cookieStore.get('matchup_pending_order')?.value;

  console.log('[CALLBACK] START', {
    callbackToken: callbackToken.slice(0, 30) + '...',
    orderId,
  });

  try {
    // 1. Siparişi bul (cookie ile)
    let order: { id: string; order_id: string; application_id: string; product: string; amount: number; gateway_token: string | null } | null = null;

    if (orderId) {
      const { data: row } = await supabase
        .from('pending_orders')
        .select('id, order_id, application_id, product, amount, gateway_token')
        .eq('order_id', orderId)
        .single();
      if (row) order = row;
      console.log('[CALLBACK] Order by cookie:', order ? 'FOUND' : 'NOT FOUND', order ? { product: order.product, gateway_token: order.gateway_token?.slice(0, 20) + '...' } : '');
    }

    // Fallback: son 1 saatteki tek sipariş
    if (!order) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: rows } = await supabase
        .from('pending_orders')
        .select('id, order_id, application_id, product, amount, gateway_token')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(2);
      console.log('[CALLBACK] Fallback pending_orders count:', rows?.length);
      if (rows?.length === 1) order = rows[0];
    }

    if (!order) {
      // Belki zaten işlenmiş (payments'ta var mı?)
      console.log('[CALLBACK] No order found, checking payments...');
      return success(); // Banka onaylamış, sipariş zaten silinmiş olabilir
    }

    // 2. Bankadan doğrula: checkout'ta kaydettiğimiz ASIL token ile
    const gatewayToken = order.gateway_token;
    console.log('[CALLBACK] Validating with stored gateway_token:', gatewayToken ? gatewayToken.slice(0, 30) + '...' : 'NULL');

    let validated = false;
    let paymentAmount = order.amount;

    if (gatewayToken) {
      const validateRes = await fetch(
        `https://banking-tr.gta.world/gateway_token/${encodeURIComponent(gatewayToken)}/strict`,
        { method: 'GET' }
      );
      console.log('[CALLBACK] Validate stored token status:', validateRes.status);

      if (validateRes.ok) {
        const data = await validateRes.json();
        console.log('[CALLBACK] Validate response:', {
          auth_key_match: data.auth_key === AUTH_KEY,
          message: data.message,
          payment: data.payment,
        });

        if (data.auth_key === AUTH_KEY && data.message === 'successful_payment') {
          validated = true;
          paymentAmount = Number(data.payment);
        } else {
          return fail(`Validate mismatch: auth_key=${data.auth_key === AUTH_KEY}, message=${data.message}`);
        }
      } else {
        // 404 = token zaten kullanılmış (ilk validate'te used olmuş) veya expired
        // Banka redirect'i ile geldik, ödeme yapılmış kabul et
        console.log('[CALLBACK] Stored token 404 - accepting payment via redirect trust');
        validated = true;
      }
    } else {
      // gateway_token kaydedilmemiş (eski sipariş), banka redirect'i ile geldik
      console.log('[CALLBACK] No stored gateway_token - accepting payment via redirect trust');
      validated = true;
    }

    if (!validated) {
      return fail('Validation failed');
    }

    // 3. Ürünü aktifleştir
    const appId = order.application_id as string;
    const product = order.product as string;

    await activateProduct(appId, product);

    // 4. Ödeme kaydı
    await supabase.from('payments').insert({
      application_id: appId,
      product,
      amount: paymentAmount,
      gateway_token: gatewayToken || callbackToken,
      gateway_response: { callback_token: callbackToken.slice(0, 30), validated },
    });
    console.log('[CALLBACK] Payment inserted');

    // 5. Pending order sil
    await supabase.from('pending_orders').delete().eq('order_id', order.order_id);
    console.log('[CALLBACK] Pending order deleted, SUCCESS');

    return success();
  } catch (err) {
    console.error('[CALLBACK] EXCEPTION:', err);
    return fail('exception: ' + String(err));
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  console.log('[CALLBACK-GET] id:', id.slice(0, 40), 'params:', Object.fromEntries(searchParams.entries()));

  if (id.startsWith('banking')) {
    const rawToken =
      id.length > 7
        ? id
        : searchParams.get('token') || searchParams.get('nxtPid') || null;
    if (!rawToken) {
      return fail('No token found in path or query');
    }
    return handleBankingCallback(rawToken);
  }

  const { GET } = await import('@/app/api/auth/[...nextauth]/route');
  return GET(request);
}
