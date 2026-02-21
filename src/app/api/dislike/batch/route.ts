import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// POST - Toplu dislike: toApplicationIds array'i, hepsine tek istekte dislike at
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
      return NextResponse.json({ success: true, processed: 0 });
    }

    const now = new Date().toISOString();
    const rows = uniqueIds.map((tid) => ({
      from_application_id: fromId,
      to_application_id: tid,
      created_at: now,
    }));

    const { error } = await supabase.from('dislikes').upsert(rows, { onConflict: 'from_application_id,to_application_id' });

    if (error) {
      console.error('Batch dislike error:', error);
      return NextResponse.json({ error: 'Reddedilemedi.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, processed: uniqueIds.length });
  } catch (error) {
    console.error('Batch dislike error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
