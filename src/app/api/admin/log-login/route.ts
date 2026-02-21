import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const adminName = request.headers.get('X-Admin-Name')?.trim();

  if (!authHeader || authHeader !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!adminName) {
    return NextResponse.json({ error: 'UCP adı zorunludur' }, { status: 400 });
  }

  try {
    const { data: existing } = await supabase
      .from('admin_login_counts')
      .select('login_count')
      .eq('admin_name', adminName)
      .single();

    const newCount = (existing?.login_count ?? 0) + 1;

    const { error } = await supabase
      .from('admin_login_counts')
      .upsert(
        {
          admin_name: adminName,
          login_count: newCount,
          last_login_at: new Date().toISOString(),
        },
        { onConflict: 'admin_name' }
      );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('log-login error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
