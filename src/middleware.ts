import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Banka ödeme sonrası GET /api/auth/callback/bankingXXXX -> token path'te, payment callback'e yönlendir
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const prefix = '/api/auth/callback/banking';

  if (request.method === 'GET' && path.startsWith(prefix)) {
    const token = path.replace('/api/auth/callback/', '');
    const url = request.nextUrl.clone();
    url.pathname = '/api/payment/callback';
    url.searchParams.set('token', token);
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/auth/callback/banking:path*',
};
