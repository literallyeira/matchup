import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function isAdmin(req: NextRequest): boolean {
  const password = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  return password === process.env.ADMIN_PASSWORD;
}

// GET - Tüm giderleri listele (admin)
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('id, description, amount, expense_date, created_at')
      .order('expense_date', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (e) {
    console.error('Expenses GET error:', e);
    return NextResponse.json({ error: 'Giderler alınamadı' }, { status: 500 });
  }
}

// POST - Yeni gider ekle (admin)
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const description = String(body.description || '').trim();
    const amount = Math.abs(Number(body.amount) || 0);
    const expense_date = body.expense_date || new Date().toISOString().slice(0, 10);

    if (!description) {
      return NextResponse.json({ error: 'Açıklama gerekli' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert({ description, amount, expense_date })
      .select('id, description, amount, expense_date, created_at')
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    console.error('Expenses POST error:', e);
    return NextResponse.json({ error: 'Gider eklenemedi' }, { status: 500 });
  }
}

// DELETE - Gider sil (admin)
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id gerekli' }, { status: 400 });
    }
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Expenses DELETE error:', e);
    return NextResponse.json({ error: 'Gider silinemedi' }, { status: 500 });
  }
}
