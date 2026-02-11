import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { extendOrSetSubscription } from '@/lib/limits';

const AUTH_KEY = process.env.GTAW_GATEWAY_AUTH_KEY!;
const BASE_URL = process.env.NEXTAUTH_URL || 'https://matchup.icu';

// GET - Banka ödeme sonrası yönlendirme (https://matchup.icu/api/auth/callback/banking)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const urlToken = searchParams.get('token');

  const cookieStore = await cookies();
  const orderId = cookieStore.get('matchup_pending_order')?.value;

  if (!orderId) {
    console.error('Banking callback: matchup_pending_order cookie bulunamadı');
    return NextResponse.redirect(new URL('/?payment=error', BASE_URL));
  }

  try {
    // Önce siparişi bul
    const { data: order, error: orderError } = await supabase
      .from('pending_orders')
      .select('application_id, product, amount, gateway_token')
      .eq('order_id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Banking callback: sipariş bulunamadı', orderId, orderError);
      return NextResponse.redirect(new URL('/?payment=error', BASE_URL));
    }

    // Token: URL'den gelen veya veritabanında kayıtlı olan
    const token = urlToken || (order.gateway_token as string | null);
    if (!token) {
      console.error('Banking callback: token bulunamadı (URL veya DB)');
      return NextResponse.redirect(new URL('/?payment=error', BASE_URL));
    }

    const validateRes = await fetch(
      `https://banking-tr.gta.world/gateway_token/${encodeURIComponent(token)}/strict`,
      { method: 'GET' }
    );

    if (!validateRes.ok) {
      console.error('Banking callback: token doğrulama başarısız', validateRes.status);
      return NextResponse.redirect(new URL('/?payment=error', BASE_URL));
    }

    const data = (await validateRes.json()) as {
      auth_key?: string;
      message?: string;
      payment?: number;
      sandbox?: boolean;
    };

    if (data.auth_key !== AUTH_KEY || data.message !== 'successful_payment') {
      console.error('Banking callback: auth_key veya message eşleşmedi', data.message);
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
      await extendOrSetSubscription(appId, 'plus', 7);
    } else if (product === 'pro') {
      await extendOrSetSubscription(appId, 'pro', 7);
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
