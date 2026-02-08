import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';

const AUTH_KEY = process.env.GTAW_GATEWAY_AUTH_KEY!;
const BASE_URL = process.env.NEXTAUTH_URL || 'https://matchup.icu';
const REDIRECT_STATUS = 302;

async function handleBankingCallback(token: string) {
  const cookieStore = await cookies();
  let orderId = cookieStore.get('matchup_pending_order')?.value;

  try {
    // Token zaten işlendiyse (çift istek – banka token'ı ilk doğrulamada "used" yapıyor) success dön
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('gateway_token', token)
      .maybeSingle();
    if (existingPayment) {
      const res = NextResponse.redirect(new URL('/?payment=success', BASE_URL), REDIRECT_STATUS);
      res.cookies.delete('matchup_pending_order');
      return res;
    }

    const validateRes = await fetch(
      `https://banking-tr.gta.world/gateway_token/${encodeURIComponent(token)}/strict`,
      { method: 'GET' }
    );

    // 404 = token zaten kullanıldı (strict mode). Payments'ta varsa yine success.
    if (!validateRes.ok) {
      const { data: paid } = await supabase
        .from('payments')
        .select('id')
        .eq('gateway_token', token)
        .maybeSingle();
      if (paid) {
        const res = NextResponse.redirect(new URL('/?payment=success', BASE_URL), REDIRECT_STATUS);
        res.cookies.delete('matchup_pending_order');
        return res;
      }
      return NextResponse.redirect(new URL('/?payment=error', BASE_URL), REDIRECT_STATUS);
    }

    const data = (await validateRes.json()) as {
      auth_key?: string;
      message?: string;
      payment?: number;
      sandbox?: boolean;
    };

    if (data.auth_key !== AUTH_KEY || data.message !== 'successful_payment') {
      return NextResponse.redirect(new URL('/?payment=error', BASE_URL), REDIRECT_STATUS);
    }

    const paymentAmount = Number(data.payment);
    let order: { application_id: string; product: string; amount: number } | null = null;

    if (orderId) {
      const { data: row, error: orderError } = await supabase
        .from('pending_orders')
        .select('application_id, product, amount')
        .eq('order_id', orderId)
        .single();
      if (!orderError && row) order = row;
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
      if (rows?.length === 1) {
        order = rows[0];
        orderId = rows[0].order_id;
      }
    }

    // Token geçerli = banka ödemeyi onayladı. Order yoksa (çift istek / zaten işlendi) yine success.
    if (!order) {
      const res = NextResponse.redirect(new URL('/?payment=success', BASE_URL), REDIRECT_STATUS);
      if (orderId) res.cookies.delete('matchup_pending_order');
      return res;
    }

    if (paymentAmount < (order.amount as number)) {
      return NextResponse.redirect(new URL('/?payment=error', BASE_URL), REDIRECT_STATUS);
    }

    const appId = order.application_id as string;
    const product = order.product as string;
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

    await supabase.from('payments').insert({
      application_id: appId,
      product,
      amount: paymentAmount,
      gateway_token: token,
      gateway_response: data,
    });

    if (orderId) await supabase.from('pending_orders').delete().eq('order_id', orderId);

    const res = NextResponse.redirect(new URL('/?payment=success', BASE_URL), REDIRECT_STATUS);
    res.cookies.delete('matchup_pending_order');
    return res;
  } catch (error) {
    console.error('Banking callback error:', error);
    return NextResponse.redirect(new URL('/?payment=error', BASE_URL), REDIRECT_STATUS);
  }
}

// GET - Banka token'ı path'e ekliyor: /api/auth/callback/banking + token → /api/auth/callback/bankingeoVW0P...
// Bu route hem "banking" + token (path) hem de gtaw vb. (NextAuth'a ilet) alır.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  if (id.startsWith('banking')) {
    // Token path'te (banking + token) veya query'de token/nxtPid olabilir
    let token =
      id.length > 7
        ? id.slice(7)
        : searchParams.get('token') ||
          (() => {
            const n = searchParams.get('nxtPid');
            return n ? (n.startsWith('banking') ? n.slice(7) : n) : null;
          })();
    if (!token) {
      return NextResponse.redirect(new URL('/?payment=error', BASE_URL), 302);
    }
    return handleBankingCallback(token);
  }

  const { GET } = await import('@/app/api/auth/[...nextauth]/route');
  return GET(request);
}
