import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ nextauth?: string[] }> }
) {
  const params = await context.params;
  const segments = params?.nextauth || [];

  // Edge case: banka tokeni path'e yapışık geliyor
  // örn: /api/auth/callback/bankingXXXXXXX -> segments = ['callback', 'bankingXXXXXX']
  // Bu durumda gerçek banking route'una yönlendir: /api/auth/callback/banking?token=XXX
  if (
    segments.length === 2 &&
    segments[0] === 'callback' &&
    segments[1].startsWith('banking') &&
    segments[1].length > 'banking'.length
  ) {
    const token = segments[1].slice('banking'.length);
    const url = new URL(req.url);
    const redirectUrl = new URL('/api/auth/callback/banking', url.origin);
    redirectUrl.searchParams.set('token', token);
    return NextResponse.redirect(redirectUrl.toString(), 302);
  }

  return handler(req, context);
}

export { handler as POST };
