import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!authHeader || authHeader !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Bug reports fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch bug reports' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Bug reports error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!authHeader || authHeader !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
    }

    const { error } = await supabase
      .from('bug_reports')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('Bug report update error:', error);
      return NextResponse.json({ error: 'Failed to update bug report' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bug report update error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
