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
function error(reason: string) {
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
}

async function findOrderByToken(token: string) {
  // token = "bankingXXX", gerçek gateway token = "XXX"
  const realToken = token.startsWith('banking') && token.length > 7 ? token.slice(7) : token;
  const tokensToSearch = realToken === token ? [token] : [token, realToken];
  console.log('[CALLBACK] findOrderByToken searching:', tokensToSearch);

  const { data: rows, error: err } = await supabase
    .from('pending_orders')
    .select('id, order_id, application_id, product, amount, gateway_token')
    .in('gateway_token', tokensToSearch);

  console.log('[CALLBACK] findOrderByToken result:', { rows: rows?.length, err: err?.message });
  if (rows?.length === 1) return rows[0];

  // Fallback: son 1 saatteki en yeni pending order
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: fallback } = await supabase
    .from('pending_orders')
    .select('id, order_id, application_id, product, amount, gateway_token')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(2);
  console.log('[CALLBACK] fallback pending_orders:', fallback?.map(r => ({ order_id: r.order_id, amount: r.amount, gateway_token: r.gateway_token })));
  if (fallback?.length === 1) return fallback[0];

  return null;
}

async function handleBankingCallback(token: string) {
  const cookieStore = await cookies();
  const orderId = cookieStore.get('matchup_pending_order')?.value;
  const realToken = token.startsWith('banking') && token.length > 7 ? token.slice(7) : token;

  console.log('[CALLBACK] START', { token: token.slice(0, 30) + '...', realToken: realToken.slice(0, 30) + '...', orderId });

  try {
    // 1. Daha önce işlenmiş mi? (payments tablosunda)
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .or(`gateway_token.eq.${token},gateway_token.eq.${realToken}`)
      .maybeSingle();
    if (existingPayment) {
      console.log('[CALLBACK] Token zaten payments\'ta, success');
      return success();
    }

    // 2. Bankadan doğrula (önce realToken, sonra tam token)
    console.log('[CALLBACK] Validating realToken:', realToken.slice(0, 30) + '...');
    let validateRes = await fetch(
      `https://banking-tr.gta.world/gateway_token/${encodeURIComponent(realToken)}/strict`,
      { method: 'GET' }
    );
    console.log('[CALLBACK] Validate realToken status:', validateRes.status);

    if (!validateRes.ok && realToken !== token) {
      console.log('[CALLBACK] Trying full token:', token.slice(0, 30) + '...');
      validateRes = await fetch(
        `https://banking-tr.gta.world/gateway_token/${encodeURIComponent(token)}/strict`,
        { method: 'GET' }
      );
      console.log('[CALLBACK] Validate full token status:', validateRes.status);
    }

    // 3A. Validate başarılı → normal akış
    if (validateRes.ok) {
      const data = await validateRes.json();
      console.log('[CALLBACK] Validate OK, data:', { auth_key_match: data.auth_key === AUTH_KEY, message: data.message, payment: data.payment, sandbox: data.sandbox });

      if (data.auth_key !== AUTH_KEY) {
        return error(`auth_key mismatch: got ${data.auth_key?.slice(0, 10)}..., expected ${AUTH_KEY?.slice(0, 10)}...`);
      }
      if (data.message !== 'successful_payment') {
        return error(`message not successful: ${data.message}`);
      }

      const paymentAmount = Number(data.payment);

      // Order bul: cookie → token → amount → fallback
      let order = null;
      if (orderId) {
        const { data: row } = await supabase
          .from('pending_orders')
          .select('id, order_id, application_id, product, amount')
          .eq('order_id', orderId)
          .single();
        if (row) order = row;
        console.log('[CALLBACK] Order by cookie:', order ? 'FOUND' : 'NOT FOUND');
      }
      if (!order) {
        order = await findOrderByToken(token);
        console.log('[CALLBACK] Order by token:', order ? 'FOUND' : 'NOT FOUND');
      }
      if (!order && paymentAmount) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const amountMatch = Math.round(paymentAmount);
        const { data: rows } = await supabase
          .from('pending_orders')
          .select('id, order_id, application_id, product, amount')
          .eq('amount', amountMatch)
          .gte('created_at', oneHourAgo)
          .order('created_at', { ascending: false })
          .limit(2);
        if (rows?.length === 1) order = rows[0];
        console.log('[CALLBACK] Order by amount:', order ? 'FOUND' : `NOT FOUND (amount=${amountMatch}, rows=${rows?.length})`);
      }

      if (!order) {
        console.log('[CALLBACK] No order found but validate OK, returning success anyway');
        return success();
      }

      if (paymentAmount < (order.amount as number)) {
        return error(`payment ${paymentAmount} < order amount ${order.amount}`);
      }

      console.log('[CALLBACK] Activating product:', order.product, 'for app:', order.application_id);
      await activateProduct(order.application_id as string, order.product as string);

      await supabase.from('payments').insert({
        application_id: order.application_id,
        product: order.product,
        amount: paymentAmount,
        gateway_token: realToken,
        gateway_response: data,
      });

      await supabase.from('pending_orders').delete().eq('order_id', order.order_id || orderId);
      console.log('[CALLBACK] SUCCESS via validate');
      return success();
    }

    // 3B. Validate başarısız (404) → pending_orders'dan token ile bul
    console.log('[CALLBACK] Validate failed, trying pending_orders by token...');

    // Daha önce işlenmiş olabilir (tekrar kontrol)
    const { data: paid } = await supabase
      .from('payments')
      .select('id')
      .or(`gateway_token.eq.${token},gateway_token.eq.${realToken}`)
      .maybeSingle();
    if (paid) {
      console.log('[CALLBACK] Token payments\'ta bulundu (post-validate), success');
      return success();
    }

    const order = await findOrderByToken(token);
    if (order) {
      console.log('[CALLBACK] Order found by token (404 path):', { product: order.product, appId: order.application_id });
      await activateProduct(order.application_id as string, order.product as string);
      await supabase.from('payments').insert({
        application_id: order.application_id,
        product: order.product,
        amount: order.amount,
        gateway_token: realToken,
        gateway_response: { message: 'validated_by_redirect_404' },
      });
      await supabase.from('pending_orders').delete().eq('order_id', order.order_id);
      console.log('[CALLBACK] SUCCESS via 404 + pending_orders');
      return success();
    }

    return error('Validate 404 + no pending order found');
  } catch (err) {
    console.error('[CALLBACK] EXCEPTION:', err);
    return error('exception: ' + String(err));
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
      return error('No token found in path or query');
    }
    return handleBankingCallback(rawToken);
  }

  const { GET } = await import('@/app/api/auth/[...nextauth]/route');
  return GET(request);
}
