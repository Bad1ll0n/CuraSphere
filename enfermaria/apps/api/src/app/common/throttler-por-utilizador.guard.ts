import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as jwt from 'jsonwebtoken';
import { AUDIENCIAS_PESSOAL, JWT_ISSUER } from '../auth/token-audiences';

/**
 * Limitação de pedidos por UTILIZADOR, não por IP (PERF-02).
 *
 * O `ThrottlerGuard` por omissão conta por `req.ip`. Atrás do nginx — e mesmo com
 * `trust proxy`, num hospital onde dezenas de postos saem pelo mesmo NAT — isso era um único
 * balde de 60 pedidos/min para o hospital inteiro, e o polling da própria web esgotava-o.
 *
 * Com uma sessão de pessoal VÁLIDA (assinatura, issuer e audience verificados, como na
 * `JwtStrategy` — nunca um token só descodificado, ver SEC-07), conta-se por utilizador.
 * Sem sessão (login, MFA, portal, quiosque) conta-se por IP — e é aí que ficam os limites
 * estritos de cada rota (`@Throttle` no login e no MFA).
 */
@Injectable()
export class ThrottlerPorUtilizadorGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const utilizador = utilizadorDaSessao(req);
    return utilizador ? `u:${utilizador}` : `ip:${req['ip']}`;
  }
}

function utilizadorDaSessao(req: Record<string, any>): string | null {
  const segredo = process.env['JWT_SECRET'];
  const autorizacao: string | undefined = req['headers']?.['authorization'];
  const token: string | undefined =
    req['cookies']?.['access_token'] ?? (autorizacao?.startsWith('Bearer ') ? autorizacao.slice(7) : undefined);
  if (!token || !segredo) return null;
  try {
    const payload = jwt.verify(token, segredo, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: AUDIENCIAS_PESSOAL as [string, ...string[]],
    }) as jwt.JwtPayload;
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null; // token inválido ou expirado: conta-se pelo IP
  }
}
