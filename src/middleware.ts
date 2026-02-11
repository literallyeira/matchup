import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Banka ödeme sonrası GET /api/auth/callback/banking -> NextAuth'a düşmesin, payment callback'e yönlendir
export function middleware(request: NextRequest) {
  if (request.method === 'GET' && request.nextUrl.pathname === '/api/auth/callback/banking') {
    const url = request.nextUrl.clone();
    url.pathname = '/api/payment/callback';
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/auth/callback/banking',
};
