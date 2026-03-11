import { NextResponse } from 'next/server';
import { supabase, type Application } from '@/lib/supabase';
import { getProfileCompleteness } from '@/lib/profile-completeness';

type HighlightProfile = Application & {
  liked_count: number;
  match_count: number;
  reason: string;
  stat_label: string;
};

function getReason(
  app: Application,
  likedCount: number,
  matchCount: number,
  completeness: number,
  hoursSinceActive: number
): string {
  if (matchCount >= 4 && matchCount >= likedCount / 2) return 'En çok eşleşenlerden';
  if (likedCount >= 6) return 'En çok beğenilenlerden';
  if (hoursSinceActive <= 6) return 'Şu an çok aktif';
  if (completeness >= 90) return 'Profili çok dolu';
  if (app.is_verified || app.phone?.trim()) return 'Güven veren profil';
  return 'Bu hafta öne çıkan';
}

function getStatLabel(likedCount: number, matchCount: number, hoursSinceActive: number): string {
  if (matchCount >= 4 && matchCount >= likedCount / 2) {
    return `${matchCount} eşleşme`;
  }
  if (likedCount >= 3) {
    return `${likedCount} beğeni`;
  }
  if (hoursSinceActive <= 1) return 'Şimdi aktif';
  if (hoursSinceActive <= 24) return `${Math.max(1, Math.floor(hoursSinceActive))} saat önce aktif`;
  return 'Bu hafta aktif';
}

function getScore(app: Application, likedCount: number, matchCount: number): number {
  const completeness = getProfileCompleteness(app);
  const lastActiveAt = app.last_active_at ? new Date(app.last_active_at).getTime() : 0;
  const hoursSinceActive = lastActiveAt ? (Date.now() - lastActiveAt) / (1000 * 60 * 60) : 999;
  const activeScore = Math.max(0, 28 - hoursSinceActive * 1.5);
  const interestScore = Math.min(likedCount * 6, 36);
  const matchScore = Math.min(matchCount * 8, 40);
  const trustScore = (app.is_verified ? 8 : 0) + (app.phone?.trim() ? 4 : 0);
  const freshnessScore = Date.now() - new Date(app.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000 ? 4 : 0;

  return completeness * 0.45 + activeScore + interestScore + matchScore + trustScore + freshnessScore;
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

    const { data: matches } = await supabase
      .from('matches')
      .select('application_1_id, application_2_id')
      .gte('created_at', weekAgoIso)
      .limit(5000);

    const likeCounts: Record<string, number> = {};
    (likes ?? []).forEach((like: { to_application_id: string }) => {
      likeCounts[like.to_application_id] = (likeCounts[like.to_application_id] || 0) + 1;
    });

    const candidateSet = new Set(candidateIds);
    const matchCounts: Record<string, number> = {};
    (matches ?? []).forEach((match: { application_1_id: string; application_2_id: string }) => {
      if (candidateSet.has(match.application_1_id)) {
        matchCounts[match.application_1_id] = (matchCounts[match.application_1_id] || 0) + 1;
      }
      if (candidateSet.has(match.application_2_id)) {
        matchCounts[match.application_2_id] = (matchCounts[match.application_2_id] || 0) + 1;
      }
    });

    const profiles: HighlightProfile[] = (candidates as Application[])
      .map((app) => {
        const likedCount = likeCounts[app.id] || 0;
        const matchCount = matchCounts[app.id] || 0;
        const completeness = getProfileCompleteness(app);
        const lastActiveAt = app.last_active_at ? new Date(app.last_active_at).getTime() : 0;
        const hoursSinceActive = lastActiveAt ? (now - lastActiveAt) / (1000 * 60 * 60) : 999;

        return {
          ...app,
          liked_count: likedCount,
          match_count: matchCount,
          reason: getReason(app, likedCount, matchCount, completeness, hoursSinceActive),
          stat_label: getStatLabel(likedCount, matchCount, hoursSinceActive),
        };
      })
      .filter((app) => getProfileCompleteness(app) >= 55 && (app.liked_count > 0 || app.match_count > 0 || app.last_active_at))
      .sort((a, b) => getScore(b, b.liked_count, b.match_count || 0) - getScore(a, a.liked_count, a.match_count || 0))
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

