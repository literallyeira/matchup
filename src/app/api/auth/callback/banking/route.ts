import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';

const AUTH_KEY = process.env.GTAW_GATEWAY_AUTH_KEY!;
const BASE_URL = process.env.NEXTAUTH_URL || 'https://matchup.icu';

// GET - Banka ödeme sonrası yönlendirme (https://matchup.icu/api/auth/callback/banking)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/?payment=error', BASE_URL));
  }

  const cookieStore = await cookies();
  const orderId = cookieStore.get('matchup_pending_order')?.value;

  if (!orderId) {
    return NextResponse.redirect(new URL('/?payment=error', BASE_URL));
  }

  try {
    const validateRes = await fetch(
      `https://banking-tr.gta.world/gateway_token/${encodeURIComponent(token)}/strict`,
      { method: 'GET' }
    );

    if (!validateRes.ok) {
      return NextResponse.redirect(new URL('/?payment=error', BASE_URL));
    }

    const data = (await validateRes.json()) as {
      auth_key?: string;
      message?: string;
      payment?: number;
      sandbox?: boolean;
    };

    if (data.auth_key !== AUTH_KEY || data.message !== 'successful_payment') {
      return NextResponse.redirect(new URL('/?payment=error', BASE_URL));
    }

    const { data: order, error: orderError } = await supabase
      .from('pending_orders')
      .select('application_id, product, amount')
      .eq('order_id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.redirect(new URL('/?payment=error', BASE_URL));
    }

    const paymentAmount = Number(data.payment);
    if (paymentAmount < (order.amount as number)) {
      return NextResponse.redirect(new URL('/?payment=error', BASE_URL));
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

    await supabase.from('pending_orders').delete().eq('order_id', orderId);

    const res = NextResponse.redirect(new URL('/?payment=success', BASE_URL));
    res.cookies.delete('matchup_pending_order');
    return res;
  } catch (error) {
    console.error('Banking callback error:', error);
    return NextResponse.redirect(new URL('/?payment=error', BASE_URL));
  }
}
