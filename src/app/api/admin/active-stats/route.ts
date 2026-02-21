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

  const ACTIVE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 saat

  try {
    const now = new Date();
    const nowMs = now.getTime();
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
    let currentActiveCount = 0;

    for (const app of list) {
      const la = app.last_active_at;
      if (!la) continue;
      const d = new Date(la);
      if (d >= todayStart && d <= todayEnd) todayCount++;
      if (d >= yesterdayStart && d < todayStart) yesterdayCount++;
      if (d >= weekStart) weekCount++;
      if (nowMs - d.getTime() < ACTIVE_THRESHOLD_MS) currentActiveCount++;
    }

    let record = Math.max(todayCount, yesterdayCount, 0);
    let dailyHistory: { stat_date: string; active_count: number }[] = [];
    try {
      const todayStr = todayStart.toISOString().slice(0, 10);
      const yesterdayStr = yesterdayStart.toISOString().slice(0, 10);

      const [todayRow, yesterdayRow] = await Promise.all([
        supabase.from('daily_active_stats').select('active_count').eq('stat_date', todayStr).single(),
        supabase.from('daily_active_stats').select('active_count').eq('stat_date', yesterdayStr).single(),
      ]);

      const todayMax = Math.max(todayRow.data?.active_count ?? 0, todayCount);
      const yesterdayMax = Math.max(yesterdayRow.data?.active_count ?? 0, yesterdayCount);

      await supabase.from('daily_active_stats').upsert([
        { stat_date: todayStr, active_count: todayMax },
        { stat_date: yesterdayStr, active_count: yesterdayMax },
      ], { onConflict: 'stat_date' });

      const [{ data: maxRow }, { data: history }] = await Promise.all([
        supabase.from('daily_active_stats').select('active_count').order('active_count', { ascending: false }).limit(1),
        supabase.from('daily_active_stats').select('stat_date, active_count').order('stat_date', { ascending: false }).limit(30),
      ]);
      if (maxRow?.[0]?.active_count != null) record = maxRow[0].active_count;
      else record = Math.max(todayMax, yesterdayMax, record);
      dailyHistory = history || [];
    } catch { record = Math.max(todayCount, yesterdayCount, 0); }

    return NextResponse.json({
      todayActive: todayCount,
      yesterdayActive: yesterdayCount,
      weekActive: weekCount,
      currentActive: currentActiveCount,
      record,
      dailyHistory,
    });
  } catch (e) {
    console.error('active-stats error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
