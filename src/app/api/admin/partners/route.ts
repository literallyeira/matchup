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
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request.headers.get('Authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { name, logo_url, link_url, sort_order } = body;
    if (!name?.trim() || !logo_url?.trim() || !link_url?.trim()) {
      return NextResponse.json({ error: 'name, logo_url ve link_url zorunludur' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('partners')
      .insert({
        name: name.trim(),
        logo_url: logo_url.trim(),
        link_url: link_url.trim(),
        sort_order: typeof sort_order === 'number' ? sort_order : 0,
      })
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Partner eklenemedi' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdmin(request.headers.get('Authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });
    const { error } = await supabase.from('partners').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Partner silinemedi' }, { status: 500 });
  }
}
