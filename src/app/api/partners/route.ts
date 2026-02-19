import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('partners')
      .select('id, name, logo_url, link_url, sort_order')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Partners fetch error:', error);
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
