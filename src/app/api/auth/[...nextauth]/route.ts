import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.pathname === '/api/auth/callback/banking') {
    const redirectUrl = new URL('/api/payment/callback', url.origin);
    url.searchParams.forEach((v, k) => redirectUrl.searchParams.set(k, v));
    return NextResponse.redirect(redirectUrl.toString(), 302);
  }
  return handler(req);
}

export { handler as POST };
