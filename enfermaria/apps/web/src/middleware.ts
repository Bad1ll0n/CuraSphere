import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { construirCsp, construirPermissionsPolicy } from './lib/csp';

// /portal and /familia have their own auth (patient Bearer token / family access token,
// both enforced API-side) — the staff access_token cookie check below doesn't apply to them.
const PUBLIC_PATHS = ['/login', '/quiosque', '/painel', '/portal', '/familia'];

/**
 * Nonce e CSP deste pedido. O cabeçalho `Content-Security-Policy` do PEDIDO não é aplicado por
 * ninguém — serve para o Next extrair o nonce e o pôr nos scripts que emite; o `x-nonce` chega
 * ao layout para o script inline do tema. O que o browser aplica é o da RESPOSTA.
 */
function politicaDoPedido() {
  const nonce = btoa(crypto.randomUUID());
  const csp = construirCsp({
    nonce,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
    jitsiServer: process.env.NEXT_PUBLIC_JITSI_SERVER,
    storageOrigin: process.env.CSP_STORAGE_ORIGIN,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    dev: process.env.NODE_ENV !== 'production',
  });
  return { nonce, csp };
}

function comCabecalhosDeSeguranca(response: NextResponse, csp: string): NextResponse {
  // CSP_MODO=report-only é a válvula operacional: se uma origem nova (outro S3, outro Jitsi)
  // ficar bloqueada em produção, a política passa a só reportar sem ser preciso novo build.
  const cabecalho = process.env.CSP_MODO === 'report-only'
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';
  response.headers.set(cabecalho, csp);
  response.headers.set('Permissions-Policy', construirPermissionsPolicy(process.env.NEXT_PUBLIC_JITSI_SERVER));
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('access_token')?.value;
  const { nonce, csp } = politicaDoPedido();

  const seguir = () => {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);
    return comCabecalhosDeSeguranca(NextResponse.next({ request: { headers: requestHeaders } }), csp);
  };

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!token) {
    if (!isPublic) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return seguir();
  }

  // Validate JWT expiry server-side
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  try {
    await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'curasphere-api',
      audience: 'curasphere',
    });
  } catch {
    // Token invalid or expired — clear cookies and redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');
    return response;
  }

  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return seguir();
}

export const config = {
  // sw.js e manifest.json ficam de fora: sem sessão, o middleware redireccionava-os para /login e
  // o browser recusa registar um service worker atrás de um redirect — a PWA nunca instalava.
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.json|.*\\.png|.*\\.svg|.*\\.ico).*)'],
};
