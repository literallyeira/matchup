import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getWantedGenders } from '@/lib/compatibility';
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

    // 4 bağımsız sorguyu paralel çalıştır
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    const [likesRes, dislikesRes, matchesRes, boostsRes] = await Promise.all([
      supabase.from('likes').select('to_application_id').eq('from_application_id', myApplication.id),
      supabase.from('dislikes').select('to_application_id').eq('from_application_id', myApplication.id).gt('created_at', tenHoursAgo),
      supabase.from('matches').select('application_1_id, application_2_id').or(`application_1_id.eq.${myApplication.id},application_2_id.eq.${myApplication.id}`),
      supabase.from('boosts').select('application_id').gt('expires_at', new Date().toISOString()),
    ]);

    const likedIds = (likesRes.data ?? []).map((r: { to_application_id: string }) => r.to_application_id);
    const dislikedIds = (dislikesRes.data ?? []).map((r: { to_application_id: string }) => r.to_application_id);
    const matchedIds: string[] = [];
    (matchesRes.data ?? []).forEach((m: { application_1_id: string; application_2_id: string }) => {
      if (m.application_1_id !== myApplication.id) matchedIds.push(m.application_1_id);
      if (m.application_2_id !== myApplication.id) matchedIds.push(m.application_2_id);
    });
    const boostedIds = new Set((boostsRes.data ?? []).map((r: { application_id: string }) => r.application_id));

    const excludeIds = [...new Set([myApplication.id, ...likedIds, ...dislikedIds, ...matchedIds])];

    // Uyumluluk: benim aradığım cinsiyetler
    const myWanted = getWantedGenders(myApplication.gender, myApplication.sexual_preference);
    if (myWanted.length === 0) {
      return NextResponse.json({ possibleMatches: [], hasApplication: true, application: myApplication });
    }

    // DB tarafında filtrele: cinsiyet uyumu + exclude ID'ler
    // Karşı tarafın tercihinin benim cinsiyetimi içerip içermediğini de DB'de kontrol ediyoruz
    const genderFilters: string[] = [];
    for (const g of myWanted) {
      if (myApplication.gender === 'erkek') {
        genderFilters.push(`and(gender.eq.${g},sexual_preference.in.(${g === 'erkek' ? 'homoseksuel,biseksuel' : 'heteroseksuel,biseksuel'}))`);
      } else {
        genderFilters.push(`and(gender.eq.${g},sexual_preference.in.(${g === 'kadin' ? 'homoseksuel,biseksuel' : 'heteroseksuel,biseksuel'}))`);
      }
    }

    // Fazla ID varsa chunk'la (Supabase URL limiti), yoksa tek sorgu
    const fetchSize = limit + 10;
    let query = supabase
      .from('applications')
      .select('*')
      .not('gender', 'is', null)
      .not('sexual_preference', 'is', null)
      .or(genderFilters.join(','))
      .limit(fetchSize);

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data: candidates, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: 'Başvurular alınamadı' }, { status: 500 });
    }

    const apps = (candidates ?? []) as Application[];

    // Öne çıkanları ilk 10'da göster, sonra diğerleri
    const boostedFirst = apps.filter((a) => boostedIds.has(a.id));
    const rest = apps.filter((a) => !boostedIds.has(a.id));
    const possible = [...boostedFirst.slice(0, 10), ...rest].slice(0, limit);

    // Profil görüntülenme kaydı (ilk 5 için, arka planda)
    if (possible.length > 0) {
      const viewRecords = possible.slice(0, 5).map(p => ({
        viewer_application_id: myApplication.id,
        viewed_application_id: p.id,
      }));
      supabase.from('profile_views').insert(viewRecords).then(() => {});
    }

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
