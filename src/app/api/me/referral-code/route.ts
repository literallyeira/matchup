import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOrCreateRefCode } from '@/lib/referral';

// GET - Kullanıcının referans kodunu ve davet linkini döndür
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.gtawId) {
    return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });
  }

  try {
    const code = await getOrCreateRefCode(session.user.gtawId);
    const baseUrl = process.env.NEXTAUTH_URL || 'https://matchup.icu';
    const inviteLink = `${baseUrl}?ref=${code}`;

    return NextResponse.json({ code, inviteLink });
  } catch (e) {
    console.error('Referral code error:', e);
    return NextResponse.json({ error: 'Kod alınamadı' }, { status: 500 });
  }
}
