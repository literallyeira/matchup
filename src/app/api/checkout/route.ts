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
  pro: { price: 12000 },
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

    const baseUrl = process.env.NEXTAUTH_URL || 'https://matchup.icu';
    const callbackUrl = `${baseUrl}/api/auth/callback/banking`;
    const gatewayUrl = `${GATEWAY_BASE}/gateway?auth_key=${encodeURIComponent(AUTH_KEY)}&type=0&price=${prod.price}&return_url=${encodeURIComponent(callbackUrl)}`;

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
