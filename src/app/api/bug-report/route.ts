import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emailIc, discordOoc, bugDescription } = body;

    if (!emailIc?.trim()) {
      return NextResponse.json(
        { error: 'Email (IC) alanı zorunludur!' },
        { status: 400 }
      );
    }

    if (!bugDescription?.trim()) {
      return NextResponse.json(
        { error: 'Bug açıklaması zorunludur!' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('bug_reports')
      .insert({
        email_ic: emailIc.trim(),
        discord_ooc: discordOoc?.trim() || null,
        bug_description: bugDescription.trim(),
      });

    if (error) {
      console.error('Bug report insert error:', error);
      return NextResponse.json(
        { error: 'Bug bildirimi kaydedilemedi. Lütfen tekrar deneyin.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bug report error:', error);
    return NextResponse.json(
      { error: 'Bir hata oluştu!' },
      { status: 500 }
    );
  }
}
