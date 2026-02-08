import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { isCompatible } from '@/lib/compatibility';
import type { Application } from '@/lib/supabase';

// GET - Olası eşleşmeler: uyumlu, henüz like/dislike/match olmamış profiller
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.gtawId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const characterId = searchParams.get('characterId');
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);

  if (!characterId) {
    return NextResponse.json({ error: 'characterId gerekli' }, { status: 400 });
  }

  try {
    const { data: myApp, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('gtaw_user_id', session.user.gtawId)
      .eq('character_id', parseInt(characterId))
      .single();

    if (appError || !myApp) {
      return NextResponse.json({ possibleMatches: [], hasApplication: false });
    }

    const myApplication = myApp as Application;

    // Benim like verdiklerim (tekrar gösterme)
    const { data: myLikes } = await supabase
      .from('likes')
      .select('to_application_id')
      .eq('from_application_id', myApplication.id);
    const likedIds = new Set((myLikes ?? []).map((r: { to_application_id: string }) => r.to_application_id));

    // Benim dislike verdiklerim
    const { data: myDislikes } = await supabase
      .from('dislikes')
      .select('to_application_id')
      .eq('from_application_id', myApplication.id);
    const dislikedIds = new Set((myDislikes ?? []).map((r: { to_application_id: string }) => r.to_application_id));

    // Zaten eşleştiğim kişiler
    const { data: myMatches } = await supabase
      .from('matches')
      .select('application_1_id, application_2_id')
      .or(`application_1_id.eq.${myApplication.id},application_2_id.eq.${myApplication.id}`);
    const matchedIds = new Set<string>();
    (myMatches ?? []).forEach((m: { application_1_id: string; application_2_id: string }) => {
      if (m.application_1_id !== myApplication.id) matchedIds.add(m.application_1_id);
      if (m.application_2_id !== myApplication.id) matchedIds.add(m.application_2_id);
    });

    const excludeIds = new Set([myApplication.id, ...likedIds, ...dislikedIds, ...matchedIds]);

    // Aktif boost’u olan application_id’ler (24 saat öne çıkanlar, herkeste ilk 10’da)
    const now = new Date().toISOString();
    const { data: boostedRows } = await supabase
      .from('boosts')
      .select('application_id')
      .gt('expires_at', now);
    const boostedIds = new Set((boostedRows ?? []).map((r: { application_id: string }) => r.application_id));

    // Tüm başvurular (kendim hariç)
    const { data: allApps, error: fetchError } = await supabase
      .from('applications')
      .select('*')
      .neq('id', myApplication.id)
      .not('gender', 'is', null)
      .not('sexual_preference', 'is', null);

    if (fetchError) {
      return NextResponse.json({ error: 'Başvurular alınamadı' }, { status: 500 });
    }

    const candidates = (allApps ?? []) as Application[];
    const compatible: Application[] = [];
    for (const app of candidates) {
      if (excludeIds.has(app.id)) continue;
      if (!isCompatible(myApplication.gender, myApplication.sexual_preference, app.gender, app.sexual_preference)) continue;
      compatible.push(app);
    }
    // Öne çıkanları ilk 10’da göster, sonra diğerleri
    const boostedFirst = compatible.filter((a) => boostedIds.has(a.id));
    const rest = compatible.filter((a) => !boostedIds.has(a.id));
    const possible = [...boostedFirst.slice(0, 10), ...rest].slice(0, limit);

    return NextResponse.json({
      possibleMatches: possible,
      hasApplication: true,
      application: myApplication,
    });
  } catch (error) {
    console.error('Possible matches error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
