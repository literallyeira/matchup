import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { consumeLikeSlot } from '@/lib/limits';

// POST - Like at: karşı taraf da beni like ettiyse match oluştur
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.gtawId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { toApplicationId, characterId } = await request.json();

    if (!toApplicationId) {
      return NextResponse.json({ error: 'toApplicationId gerekli' }, { status: 400 });
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

    const fromId = myApp.id;

    if (fromId === toApplicationId) {
      return NextResponse.json({ error: 'Kendine like atamazsın' }, { status: 400 });
    }

    const limitResult = await consumeLikeSlot(fromId);
    if (!limitResult.ok) {
      return NextResponse.json(
        { error: 'Günlük like hakkınız doldu. 24 saat sonra yenilenecek.', remaining: 0, resetAt: limitResult.resetAt },
        { status: 429 }
      );
    }

    // Like ekle (varsa ignore)
    const { error: likeError } = await supabase
      .from('likes')
      .upsert(
        { from_application_id: fromId, to_application_id: toApplicationId },
        { onConflict: 'from_application_id,to_application_id' }
      );

    if (likeError) {
      return NextResponse.json({ error: 'Like kaydedilemedi' }, { status: 500 });
    }

    // Karşı taraf beni daha önce like etti mi?
    const { data: theirLike } = await supabase
      .from('likes')
      .select('id')
      .eq('from_application_id', toApplicationId)
      .eq('to_application_id', fromId)
      .maybeSingle();

    let isMatch = false;
    if (theirLike) {
      const [app1, app2] = [fromId, toApplicationId].sort();
      const { error: matchError } = await supabase.from('matches').upsert(
        {
          application_1_id: app1,
          application_2_id: app2,
          created_by: 'mutual_like',
        },
        { onConflict: 'application_1_id,application_2_id' }
      );
      isMatch = !matchError;
    }

    return NextResponse.json({
      success: true,
      isMatch,
      remaining: limitResult.remaining,
      resetAt: limitResult.resetAt,
    });
  } catch (error) {
    console.error('Like error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
