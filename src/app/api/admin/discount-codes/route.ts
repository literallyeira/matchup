import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function isAdmin(request: Request): boolean {
  const password = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  return password === ADMIN_PASSWORD;
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }
  try {
    const { data, error } = await supabase
      .from('discount_codes')
      .select('id, code, discount_type, discount_value, valid_from, valid_until, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (e) {
    console.error('Admin discount-codes GET:', e);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const code = String(body.code || '').trim().toUpperCase();
    const discount_type = body.discount_type === 'fixed' ? 'fixed' : 'percent';
    const discount_value = Math.max(0, parseInt(String(body.discount_value), 10) || 0);
    const valid_until = body.valid_until || null;

    if (!code) {
      return NextResponse.json({ error: 'Kod gerekli' }, { status: 400 });
    }
    if (discount_type === 'percent' && (discount_value < 1 || discount_value > 100)) {
      return NextResponse.json({ error: 'Yüzde 1-100 arası olmalı' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('discount_codes')
      .insert({
        code,
        discount_type,
        discount_value,
        valid_until: valid_until ? new Date(valid_until).toISOString() : null,
      })
      .select('id, code, discount_type, discount_value, valid_until, created_at')
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Bu kod zaten var' }, { status: 400 });
      throw error;
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error('Admin discount-codes POST:', e);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
