import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Günün profili: en çok beğeni alan veya boostlu profil
export async function GET() {
  try {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    // Önce bugün boost'u olan birini bul
    const { data: boostedApps } = await supabase
      .from('boosts')
      .select('application_id')
      .gt('expires_at', now.toISOString())
      .limit(1);

    let spotlightId: string | null = null;

    if (boostedApps?.length) {
      spotlightId = boostedApps[0].application_id;
    } else {
      // Boost yoksa, son 7 günde en çok beğeni alan profili bul
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: topLiked } = await supabase
        .from('likes')
        .select('to_application_id')
        .gt('created_at', weekAgo);

      if (topLiked?.length) {
        // En çok beğenileni bul
        const counts: Record<string, number> = {};
        topLiked.forEach((l: { to_application_id: string }) => {
          counts[l.to_application_id] = (counts[l.to_application_id] || 0) + 1;
        });
        // Günün hash'ine göre rotate et (her gün farklı biri)
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const dayHash = todayKey.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const idx = dayHash % Math.min(sorted.length, 5); // top 5'ten birini seç
        spotlightId = sorted[idx]?.[0] || null;
      }
    }

    if (!spotlightId) {
      return NextResponse.json({ spotlight: null });
    }

    const { data: profile } = await supabase
      .from('applications')
      .select('id, first_name, last_name, age, gender, sexual_preference, phone, facebrowser, photo_url, description, is_verified, extra_photos, prompts, created_at, weight, gtaw_user_id, character_id, character_name')
      .eq('id', spotlightId)
      .single();

    if (!profile) {
      return NextResponse.json({ spotlight: null });
    }

    return NextResponse.json({ spotlight: profile });
  } catch (error) {
    console.error('Spotlight error:', error);
    return NextResponse.json({ spotlight: null });
  }
}
