import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { consumeLikeSlots } from '@/lib/limits';

// POST - Toplu like: toApplicationIds array'i, hepsine tek istekte like at
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.gtawId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { toApplicationIds, characterId } = await request.json();

    if (!Array.isArray(toApplicationIds) || toApplicationIds.length === 0) {
      return NextResponse.json({ error: 'toApplicationIds gerekli (boş olmayan dizi)' }, { status: 400 });
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

    supabase.from('applications').update({ last_active_at: new Date().toISOString() }).eq('id', fromId).then(() => {});

    const uniqueIds = [...new Set(toApplicationIds)].filter((id) => id && id !== fromId) as string[];

    if (uniqueIds.length === 0) {
      return NextResponse.json({ success: true, matchCount: 0, processed: 0 });
    }

    // Zaten beğenilmişleri filtrele
    const { data: existing } = await supabase
      .from('likes')
      .select('to_application_id')
      .eq('from_application_id', fromId)
      .in('to_application_id', uniqueIds);

    const existingIds = new Set((existing ?? []).map((r) => r.to_application_id));
    const toLike = uniqueIds.filter((id) => !existingIds.has(id));

    if (toLike.length === 0) {
      const limits = await import('@/lib/limits').then((m) => m.getLimitsInfo(fromId));
      return NextResponse.json({ success: true, matchCount: 0, processed: 0, remaining: limits.remaining, resetAt: limits.resetAt });
    }

    const slotResult = await consumeLikeSlots(fromId, toLike.length);
    if (!slotResult.ok && slotResult.consumed === 0) {
      return NextResponse.json(
        { error: 'Günlük like hakkınız doldu.', remaining: 0, resetAt: slotResult.resetAt },
        { status: 429 }
      );
    }

    const toInsert = toLike.slice(0, slotResult.consumed);
    const rows = toInsert.map((tid) => ({ from_application_id: fromId, to_application_id: tid }));

    const { error: upsertErr } = await supabase.from('likes').upsert(rows, { onConflict: 'from_application_id,to_application_id' });
    if (upsertErr) {
      console.error('Batch like upsert error:', upsertErr);
      return NextResponse.json({ error: 'Like kaydedilemedi.' }, { status: 500 });
    }

    // Karşı taraf beni like etmiş mi? Match oluştur
    const { data: theirLikes } = await supabase
      .from('likes')
      .select('from_application_id')
      .eq('to_application_id', fromId)
      .in('from_application_id', toInsert);

    let matchCount = 0;
    for (const r of theirLikes ?? []) {
      const [app1, app2] = [fromId, r.from_application_id].sort();
      const { error: matchErr } = await supabase
        .from('matches')
        .upsert({ application_1_id: app1, application_2_id: app2, created_by: 'mutual_like' }, { onConflict: 'application_1_id,application_2_id' });
      if (!matchErr) matchCount++;
    }

    return NextResponse.json({
      success: true,
      matchCount,
      processed: toInsert.length,
      remaining: slotResult.remaining,
      resetAt: slotResult.resetAt,
    });
  } catch (error) {
    console.error('Batch like error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
