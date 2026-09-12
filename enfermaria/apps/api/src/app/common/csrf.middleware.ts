import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Cookies que fazem o browser autenticar o pedido sozinho. É a presença de um destes —
 * e só ela — que torna um pedido vulnerável a CSRF.
 */
const COOKIES_DE_SESSAO = ['access_token', 'refresh_token', 'portal_token'];

/** Comparação em tempo constante — evita distinguir o token por temporização. */
function iguaisTempoConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function origensPermitidas(): string[] | null {
  const raw = process.env['ALLOWED_ORIGINS'];
  if (raw) return raw.split(',').map((o) => o.trim()).filter(Boolean);
  return null;
}

function origemAceite(origem: string): boolean {
  const allowlist = origensPermitidas();
  if (allowlist) return allowlist.includes(origem);
  // Sem ALLOWED_ORIGINS (dev): mesma política do CORS em `main.ts`.
  return origem.startsWith('http://localhost') || origem.startsWith('http://127.0.0.1');
}

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    if (SAFE_METHODS.has(req.method)) return next();

    // SEC-16: a versão anterior fazia `if (!cookieToken) return next()` — ou seja, bastava
    // ao atacante que a vítima NÃO tivesse o cookie `csrf-token` para o middleware se
    // desligar sozinho, exactamente no caso em que a protecção era necessária. E como o
    // cookie `csrf-token` é `httpOnly: false` e `sameSite: 'strict'`, um pedido
    // cross-site nunca o leva — logo a condição de escape era trivial de satisfazer:
    // qualquer POST forjado a partir de outro site caía no `next()`.
    //
    // O critério correcto não é "tem cookie de CSRF?" mas "o browser está a autenticar
    // este pedido sozinho?".
    const temSessaoPorCookie = COOKIES_DE_SESSAO.some((c) => Boolean(req.cookies?.[c]));
    if (!temSessaoPorCookie) {
      // Sem cookie de sessão não há CSRF possível: um pedido forjado não consegue
      // fabricar o cabeçalho `Authorization`. Cobre mobile, Postman e server-to-server.
      return next();
    }

    const cookieToken: string | undefined = req.cookies?.['csrf-token'];

    if (cookieToken) {
      // Caminho normal: double-submit cookie.
      const headerToken: string | undefined = req.headers['x-csrf-token'];
      if (!headerToken || !iguaisTempoConstante(headerToken, cookieToken)) {
        throw new ForbiddenException('CSRF token inválido');
      }
      return next();
    }

    // Sessão por cookie mas ainda sem cookie de CSRF (o cliente não chamou
    // `GET /v1/csrf-token`). Já não passa em branco: exige-se que a origem do pedido
    // seja uma das permitidas. Um pedido cross-site traz a `Origin` do atacante — ou,
    // num form POST simples, nenhuma — e é recusado nos dois casos.
    const origem: string | undefined = req.headers['origin'];
    if (origem && origemAceite(origem)) return next();

    const referer: string | undefined = req.headers['referer'];
    if (!origem && referer) {
      try {
        if (origemAceite(new URL(referer).origin)) return next();
      } catch { /* referer malformado → recusa */ }
    }

    throw new ForbiddenException('CSRF token em falta');
  }
}
