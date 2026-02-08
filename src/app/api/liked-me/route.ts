import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getTier } from '@/lib/limits';
import type { Application } from '@/lib/supabase';

// GET - Beni like edenler (sadece Pro)
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.gtawId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const characterId = searchParams.get('characterId');
  if (!characterId) {
    return NextResponse.json({ error: 'characterId gerekli' }, { status: 400 });
  }

  try {
    const { data: myApp, error: appError } = await supabase
      .from('applications')
      .select('id')
      .eq('gtaw_user_id', session.user.gtawId)
      .eq('character_id', parseInt(characterId))
      .single();

    if (appError || !myApp) {
      return NextResponse.json({ error: 'Profil bulunamadı' }, { status: 404 });
    }

    const tier = await getTier(myApp.id);
    if (tier !== 'pro') {
      return NextResponse.json(
        { error: 'Bu özellik sadece MatchUp Pro üyeleri içindir.', requiredTier: 'pro' },
        { status: 403 }
      );
    }

    // 4 bağımsız sorguyu paralel çalıştır (eskiden 4 sequential)
    const [likesRes, matchesRes, dislikesRes, myLikesRes] = await Promise.all([
      supabase.from('likes').select('from_application_id').eq('to_application_id', myApp.id),
      supabase.from('matches').select('application_1_id, application_2_id').or(`application_1_id.eq.${myApp.id},application_2_id.eq.${myApp.id}`),
      supabase.from('dislikes').select('to_application_id').eq('from_application_id', myApp.id),
      supabase.from('likes').select('to_application_id').eq('from_application_id', myApp.id),
    ]);

    const fromIds = (likesRes.data ?? []).map((r: { from_application_id: string }) => r.from_application_id);
    if (fromIds.length === 0) {
      return NextResponse.json({ likedBy: [] });
    }

    // Eşleşmiş kişiler
    const matchedIds = new Set<string>();
    (matchesRes.data ?? []).forEach((m: { application_1_id: string; application_2_id: string }) => {
      if (m.application_1_id === myApp.id) matchedIds.add(m.application_2_id);
      else matchedIds.add(m.application_1_id);
    });

    // Reddettiğimiz + beğendiğimiz kişiler
    const dislikedIds = new Set((dislikesRes.data ?? []).map((d: { to_application_id: string }) => d.to_application_id));
    const likedIds = new Set((myLikesRes.data ?? []).map((l: { to_application_id: string }) => l.to_application_id));

    // Filtrele: eşleşmiş, reddetmiş veya zaten beğenmiş olanları çıkar
    const filteredFromIds = fromIds.filter((id: string) => !matchedIds.has(id) && !dislikedIds.has(id) && !likedIds.has(id));
    if (filteredFromIds.length === 0) {
      return NextResponse.json({ likedBy: [] });
    }

    const { data: apps } = await supabase
      .from('applications')
      .select('*')
      .in('id', filteredFromIds);

    const list = (apps ?? []) as Application[];
    return NextResponse.json({ likedBy: list });
  } catch (error) {
    console.error('Liked-me error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
