import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function isAdmin(authHeader: string | null): boolean {
  const token = authHeader?.replace('Bearer ', '');
  return !!token && token === process.env.ADMIN_PASSWORD;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request.headers.get('Authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: apps } = await supabase
      .from('applications')
      .select('last_active_at');

    const list = apps || [];
    let todayCount = 0;
    let yesterdayCount = 0;
    let weekCount = 0;

    for (const app of list) {
      const la = app.last_active_at;
      if (!la) continue;
      const d = new Date(la);
      if (d >= todayStart && d <= todayEnd) todayCount++;
      if (d >= yesterdayStart && d < todayStart) yesterdayCount++;
      if (d >= weekStart) weekCount++;
    }

    let record = Math.max(todayCount, yesterdayCount, 0);
    try {
      const todayStr = todayStart.toISOString().slice(0, 10);
      await supabase
        .from('daily_active_stats')
        .upsert(
          { stat_date: todayStr, active_count: todayCount },
          { onConflict: 'stat_date' }
        );
      const { data: dailyRows } = await supabase
        .from('daily_active_stats')
        .select('active_count')
        .order('active_count', { ascending: false })
        .limit(1);
      if (dailyRows?.[0]?.active_count != null) record = dailyRows[0].active_count;
    } catch { /* daily_active_stats tablosu yoksa fallback kullan */ }

    return NextResponse.json({
      todayActive: todayCount,
      yesterdayActive: yesterdayCount,
      weekActive: weekCount,
      record,
    });
  } catch (e) {
    console.error('active-stats error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
