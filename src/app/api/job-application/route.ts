import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { characterName, phoneNumber, address, background, education } = body;

    if (!characterName?.trim()) {
      return NextResponse.json(
        { error: 'Karakter adı zorunludur!' },
        { status: 400 }
      );
    }

    if (!phoneNumber?.trim()) {
      return NextResponse.json(
        { error: 'Telefon numarası zorunludur!' },
        { status: 400 }
      );
    }

    if (!address?.trim()) {
      return NextResponse.json(
        { error: 'Adres zorunludur!' },
        { status: 400 }
      );
    }

    if (!background?.trim()) {
      return NextResponse.json(
        { error: 'Geçmiş bilgisi zorunludur!' },
        { status: 400 }
      );
    }

    if (!education?.trim()) {
      return NextResponse.json(
        { error: 'Eğitim durumu zorunludur!' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('job_applications')
      .insert({
        character_name: characterName.trim(),
        phone_number: phoneNumber.trim(),
        address: address.trim(),
        background: background.trim(),
        education: education.trim(),
      });

    if (error) {
      console.error('Job application insert error:', error);
      return NextResponse.json(
        { error: 'Başvuru kaydedilemedi. Lütfen tekrar deneyin.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Job application error:', error);
    return NextResponse.json(
      { error: 'Bir hata oluştu!' },
      { status: 500 }
    );
  }
}
