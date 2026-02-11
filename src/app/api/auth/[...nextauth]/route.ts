import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ nextauth?: string[] }> }
) {
  const url = new URL(req.url);
  const pathAfterCallback = url.pathname.replace('/api/auth/callback/', '');

  // Banka tokeni path'e yapışık geliyor: /api/auth/callback/bankingXXXXXXX
  if (pathAfterCallback.startsWith('banking')) {
    const token = pathAfterCallback; // tüm token ("bankingXXXX...")
    const redirectUrl = new URL('/api/payment/callback', url.origin);
    redirectUrl.searchParams.set('token', token);
    return NextResponse.redirect(redirectUrl.toString(), 302);
  }

  return handler(req, context);
}

export { handler as POST };
