import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { validateDiscountCode, getBasePrice } from '@/lib/discount';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.gtawId) {
    return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });
  }

  try {
    const { code, product, characterId } = await request.json();
    if (!product || !characterId) {
      return NextResponse.json({ error: 'Ürün ve karakter gerekli' }, { status: 400 });
    }

    const { data: myApp } = await supabase
      .from('applications')
      .select('id')
      .eq('gtaw_user_id', session.user.gtawId)
      .eq('character_id', parseInt(characterId))
      .single();

    if (!myApp) {
      return NextResponse.json({ error: 'Profil bulunamadı' }, { status: 404 });
    }

    const result = await validateDiscountCode(code || '', product, myApp.id);
    const basePrice = getBasePrice(product);

    if (result.valid) {
      return NextResponse.json({
        valid: true,
        finalPrice: result.finalPrice,
        discountAmount: result.discountAmount,
        basePrice,
      });
    }
    return NextResponse.json({
      valid: false,
      error: result.error,
      basePrice,
    });
  } catch (e) {
    console.error('Discount validate error:', e);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
