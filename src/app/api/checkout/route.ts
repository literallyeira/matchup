import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

function generateOrderId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const AUTH_KEY = process.env.GTAW_GATEWAY_AUTH_KEY!;
const GATEWAY_BASE = 'https://banking-tr.gta.world';

const PRODUCTS: Record<string, { price: number }> = {
  plus: { price: 5000 },
  pro: { price: 16500 },
  boost: { price: 5000 },
};

// POST - Ödeme başlat: pending order + gateway redirect URL
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.gtawId) {
    return NextResponse.json({ error: 'Giriş yapmanız gerekir' }, { status: 401 });
  }

  if (!AUTH_KEY) {
    return NextResponse.json({ error: 'Ödeme sistemi yapılandırılmamış' }, { status: 500 });
  }

  try {
    const { product, characterId } = await request.json();
    if (!product || !['plus', 'pro', 'boost'].includes(product)) {
      return NextResponse.json({ error: 'Geçersiz ürün' }, { status: 400 });
    }
    if (!characterId) {
      return NextResponse.json({ error: 'characterId gerekli' }, { status: 400 });
    }

    const { data: myApp, error: appError } = await supabase
      .from('applications')
      .select('id')
      .eq('gtaw_user_id', session.user.gtawId)
      .eq('character_id', parseInt(characterId))
      .single();

    if (appError || !myApp) {
      return NextResponse.json({ error: 'Profil bulunamadı' }, { status: 404 });
    }

    const prod = PRODUCTS[product];
    const orderId = generateOrderId();

    const { error: insertError } = await supabase.from('pending_orders').insert({
      order_id: orderId,
      application_id: myApp.id,
      product,
      amount: prod.price,
    });

    if (insertError) {
      return NextResponse.json({ error: 'Sipariş oluşturulamadı' }, { status: 500 });
    }

    // Token akışı: önce token üret, sonra /gateway/{token} ile yönlendir (query string 404 veriyor)
    const tokenRes = await fetch(
      `${GATEWAY_BASE}/gateway_token/generateToken?price=${prod.price}&type=0`,
      { headers: { Authorization: `Bearer ${AUTH_KEY}` } }
    );
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Gateway token error:', tokenRes.status, errText);
      return NextResponse.json(
        { error: 'Ödeme sayfası açılamadı. Lütfen daha sonra deneyin.' },
        { status: 502 }
      );
    }
    const paymentTokenRaw = await tokenRes.text();
    let token: string;
    try {
      const parsed = JSON.parse(paymentTokenRaw);
      token = typeof parsed === 'string' ? parsed : (parsed?.token ?? parsed?.data ?? String(parsed));
    } catch {
      token = paymentTokenRaw.replace(/^"|"$/g, '').trim();
    }
    if (!token) {
      return NextResponse.json({ error: 'Ödeme token alınamadı' }, { status: 502 });
    }
    await supabase.from('pending_orders').update({ gateway_token: token }).eq('order_id', orderId);

    const gatewayUrl = `${GATEWAY_BASE}/gateway/${encodeURIComponent(token)}`;

    const res = NextResponse.json({ redirectUrl: gatewayUrl });
    res.cookies.set('matchup_pending_order', orderId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 30,
      path: '/',
    });
    return res;
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
