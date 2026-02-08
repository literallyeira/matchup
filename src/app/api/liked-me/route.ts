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

    const { data: likes } = await supabase
      .from('likes')
      .select('from_application_id')
      .eq('to_application_id', myApp.id);

    const fromIds = (likes ?? []).map((r: { from_application_id: string }) => r.from_application_id);
    if (fromIds.length === 0) {
      return NextResponse.json({ likedBy: [] });
    }

    const { data: apps } = await supabase
      .from('applications')
      .select('*')
      .in('id', fromIds);

    // Zaten eşleştiğimiz kişileri çıkar (match varsa listede göstermeyebiliriz; istersen göster)
    const list = (apps ?? []) as Application[];
    return NextResponse.json({ likedBy: list });
  } catch (error) {
    console.error('Liked-me error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
