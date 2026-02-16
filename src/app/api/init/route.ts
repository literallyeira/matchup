import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getLimitsInfo } from '@/lib/limits';

// GET - Tek istekte application + matches + limits + likedByCount
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
      .select('*')
      .eq('gtaw_user_id', session.user.gtawId)
      .eq('character_id', parseInt(characterId))
      .single();

    if (appError || !myApp) {
      return NextResponse.json({
        hasApplication: false,
        matches: [],
        limits: null,
        likedByCount: 0,
        application: null,
      });
    }

    // Paralel: matches + limits + likedByCount
    const [matchesResult, limitsResult, likedByResult] = await Promise.all([
      supabase
        .from('matches')
        .select(`
          id,
          created_at,
          application_1_id,
          application_2_id,
          application_1:applications!matches_application_1_id_fkey(
            id, first_name, last_name, age, gender, sexual_preference,
            phone, facebrowser, description, photo_url, character_name,
            extra_photos, prompts, is_verified, created_at
          ),
          application_2:applications!matches_application_2_id_fkey(
            id, first_name, last_name, age, gender, sexual_preference,
            phone, facebrowser, description, photo_url, character_name,
            extra_photos, prompts, is_verified, created_at
          )
        `)
        .or(`application_1_id.eq.${myApp.id},application_2_id.eq.${myApp.id}`),

      getLimitsInfo(myApp.id),

      supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('to_application_id', myApp.id),
    ]);

    const transformedMatches = (matchesResult.data ?? []).map(match => {
      const isApp1 = match.application_1_id === myApp.id;
      const matchedWith = isApp1 ? match.application_2 : match.application_1;
      return {
        id: match.id,
        created_at: match.created_at,
        matchedWith,
        myApplicationId: myApp.id,
      };
    });

    return NextResponse.json({
      hasApplication: true,
      application: myApp,
      matches: transformedMatches,
      limits: limitsResult,
      likedByCount: likedByResult.count ?? 0,
    });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
