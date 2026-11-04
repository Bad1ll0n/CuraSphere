import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { RedisService } from '../redis/redis.service';

export interface PayloadQuiosque {
  servicoId: string;
  purpose: string;
  iat?: number;
  exp?: number;
}

/**
 * Idade máxima aceite para um token de quiosque, independentemente do `exp` que ele
 * traga assinado (SEC-17). Os tokens são emitidos com `expiresIn: '365d'` em
 * `doentes.service.ts:gerarTokenQuiosque` e não há forma de os revogar: um tablet de
 * quiosque perdido ou roubado dá acesso durante um ano.
 *
 * Como o lado da emissão pertence a outro módulo, o limite é imposto aqui, na validação,
 * a partir do `iat` — o que funciona para os tokens já emitidos, sem reassinar nada.
 */
export const MAX_IDADE_DIAS_OMISSAO = 30;

/**
 * Autentica os terminais de quiosque (SEC-02).
 *
 * O `QuiosqueController` de `tickets/` não tinha guard nenhum — o único `APP_GUARD` da app
 * é o `ThrottlerGuard`. `GET /v1/quiosque/paciente?nif=X` devolvia id, nome e data de
 * nascimento sem autenticação, e encadeando com `/paciente/:id/marcacoes-hoje` obtinha-se
 * a consulta e a especialidade — dados de saúde, art.º 9.º do RGPD.
 *
 * Reutiliza o conceito de token de quiosque que já existia no projecto (`QUIOSQUE_SECRET`
 * + claim `purpose: 'quiosque'`, emitido por `POST /v1/doentes/quiosque-token`, restrito a
 * `direcao`/`ti`/`administrativo`) em vez de inventar um segundo mecanismo. O segredo é
 * distinto do `JWT_SECRET`, pelo que este domínio de token já estava separado dos outros.
 *
 * O token é aceite no cabeçalho `X-Quiosque-Token`, em `Authorization: Bearer` ou no
 * parâmetro `?token=` (formato que a página `/quiosque/[servicoId]` já usa hoje).
 */
@Injectable()
export class QuiosqueGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const secret = this.config.get<string>('QUIOSQUE_SECRET');
    // Fail-closed: sem segredo configurado nenhum quiosque é válido — nunca "deixa passar".
    if (!secret) throw new UnauthorizedException('Quiosque não configurado');

    const token = this.extrairToken(req);
    if (!token) throw new UnauthorizedException('Token de quiosque em falta');

    let payload: PayloadQuiosque;
    try {
      payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as PayloadQuiosque;
    } catch {
      throw new UnauthorizedException('Token de quiosque inválido ou expirado');
    }

    if (payload.purpose !== 'quiosque' || !payload.servicoId) {
      throw new UnauthorizedException('Token de quiosque inválido');
    }

    // SEC-17 — limite de idade imposto na validação, independente do `exp` assinado.
    const maxDias = Number(this.config.get<string>('QUIOSQUE_TOKEN_MAX_DIAS') ?? MAX_IDADE_DIAS_OMISSAO);
    if (!payload.iat || Date.now() - payload.iat * 1000 > maxDias * 24 * 60 * 60 * 1000) {
      throw new UnauthorizedException('Token de quiosque demasiado antigo — gere um novo');
    }

    // SEC-17 — revogação. Duas granularidades, ambas em Redis:
    //   quiosque:revogado:<sha256(token)>        → revoga um terminal concreto
    //   quiosque:revogado-antes:<servicoId>      → revoga em bloco (epoch ms) todos os
    //                                              tokens de um serviço emitidos antes de X
    // Nota: `RedisService.get` devolve null com o Redis em baixo, pelo que a revogação
    // degrada aberta — mas o limite de idade acima é independente do Redis e continua a
    // garantir um tecto duro. É o mesmo compromisso já assumido no login de pessoal.
    const impressao = createHash('sha256').update(token).digest('hex');
    if (await this.redis.get<string>(`quiosque:revogado:${impressao}`)) {
      throw new UnauthorizedException('Token de quiosque revogado');
    }
    const revogadoAntes = await this.redis.get<number>(`quiosque:revogado-antes:${payload.servicoId}`);
    if (revogadoAntes && payload.iat * 1000 < revogadoAntes) {
      throw new UnauthorizedException('Token de quiosque revogado');
    }

    // Quando o pedido identifica um serviço, o token tem de ser o desse serviço — impede
    // que o quiosque de um serviço leia dados de outro.
    const servicoPedido = req.params?.servicoId ?? req.query?.servicoId;
    if (servicoPedido && servicoPedido !== payload.servicoId) {
      throw new UnauthorizedException('Token de quiosque não pertence a este serviço');
    }

    req.quiosque = { servicoId: payload.servicoId };
    return true;
  }

  private extrairToken(req: any): string | null {
    const header = req.headers?.['x-quiosque-token'];
    if (typeof header === 'string' && header) return header;

    const auth = req.headers?.authorization;
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim() || null;
    }

    const query = req.query?.token;
    return typeof query === 'string' && query ? query : null;
  }
}
