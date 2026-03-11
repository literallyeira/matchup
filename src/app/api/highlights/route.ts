import { NextResponse } from 'next/server';
import { supabase, type Application } from '@/lib/supabase';
import { getProfileCompleteness } from '@/lib/profile-completeness';

type HighlightProfile = Application & {
  liked_count: number;
  reason: string;
};

function getReason(app: Application, likedCount: number, completeness: number, hoursSinceActive: number): string {
  if (likedCount >= 6) return 'Bu hafta ilgi görüyor';
  if (hoursSinceActive <= 6) return 'Şu an çok aktif';
  if (completeness >= 90) return 'Profili çok dolu';
  if (app.is_verified || app.phone?.trim()) return 'Güven veren profil';
  return 'Bu hafta öne çıkan';
}

function getScore(app: Application, likedCount: number): number {
  const completeness = getProfileCompleteness(app);
  const lastActiveAt = app.last_active_at ? new Date(app.last_active_at).getTime() : 0;
  const hoursSinceActive = lastActiveAt ? (Date.now() - lastActiveAt) / (1000 * 60 * 60) : 999;
  const activeScore = Math.max(0, 28 - hoursSinceActive * 1.5);
  const interestScore = Math.min(likedCount * 6, 36);
  const trustScore = (app.is_verified ? 8 : 0) + (app.phone?.trim() ? 4 : 0);
  const freshnessScore = Date.now() - new Date(app.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000 ? 4 : 0;

  return completeness * 0.55 + activeScore + interestScore + trustScore + freshnessScore;
}

// GET - Haftanın öne çıkan profilleri
export async function GET() {
  try {
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'weekly_highlights_enabled')
      .maybeSingle();

    const enabled = settings?.value === 'true';
    if (!enabled) {
      return NextResponse.json({ enabled: false, profiles: [] });
    }

    const now = Date.now();
    const weekAgoIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidates, error: applicationsError } = await supabase
      .from('applications')
      .select(`
        id,
        first_name,
        last_name,
        age,
        weight,
        gender,
        sexual_preference,
        phone,
        facebrowser,
        description,
        photo_url,
        extra_photos,
        prompts,
        is_verified,
        created_at,
        last_active_at,
        character_name,
        looking_for
      `)
      .not('photo_url', 'is', null)
      .gte('last_active_at', weekAgoIso)
      .order('last_active_at', { ascending: false })
      .limit(180);

    if (applicationsError) {
      throw applicationsError;
    }

    if (!candidates?.length) {
      return NextResponse.json({ enabled: true, profiles: [] });
    }

    const candidateIds = candidates.map((app: Application) => app.id);

    const { data: likes } = await supabase
      .from('likes')
      .select('to_application_id')
      .in('to_application_id', candidateIds)
      .gte('created_at', weekAgoIso)
      .limit(5000);

    const likeCounts: Record<string, number> = {};
    (likes ?? []).forEach((like: { to_application_id: string }) => {
      likeCounts[like.to_application_id] = (likeCounts[like.to_application_id] || 0) + 1;
    });

    const profiles: HighlightProfile[] = (candidates as Application[])
      .map((app) => {
        const likedCount = likeCounts[app.id] || 0;
        const completeness = getProfileCompleteness(app);
        const lastActiveAt = app.last_active_at ? new Date(app.last_active_at).getTime() : 0;
        const hoursSinceActive = lastActiveAt ? (now - lastActiveAt) / (1000 * 60 * 60) : 999;

        return {
          ...app,
          liked_count: likedCount,
          reason: getReason(app, likedCount, completeness, hoursSinceActive),
          match_count: 0,
        };
      })
      .filter((app) => getProfileCompleteness(app) >= 55)
      .sort((a, b) => getScore(b, b.liked_count) - getScore(a, a.liked_count))
      .slice(0, 8);

    return NextResponse.json(
      { enabled: true, profiles },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } }
    );
  } catch (error) {
    console.error('Highlights error:', error);
    return NextResponse.json({ enabled: false, profiles: [] }, { status: 200 });
  }
}

