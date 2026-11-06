import { Controller, Get, Res, ServiceUnavailableException } from '@nestjs/common';
import type { Response } from 'express';
import { randomBytes } from 'crypto';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';
import { AuditoriaInstaladaService } from './common/auditoria-instalada.service';

type ComponentStatus = { status: 'up' | 'down' };

@SkipThrottle()
@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auditoria: AuditoriaInstaladaService,
  ) {}

  @Get()
  getData() {
    return { message: 'CuraSphere API' };
  }

  @Get('csrf-token')
  getCsrfToken(@Res() res: Response) {
    const token = randomBytes(32).toString('hex');
    res.cookie('csrf-token', token, {
      httpOnly: false, // must be readable by JS
      sameSite: 'strict',
      secure: process.env['NODE_ENV'] === 'production',
    });
    res.json({ token });
  }

  /**
   * OPS-06 — liveness: o processo responde (event loop livre). Sem I/O, para que uma BD em
   * baixo não leve o orquestrador/autoheal a reiniciar uma API que está bem. É o healthcheck
   * do contentor.
   */
  @Get('health/live')
  live() {
    return { status: 'ok', uptimeSegundos: Math.round(process.uptime()) };
  }

  /**
   * OPS-06 — readiness: pode receber tráfego? BD, migrações sem falhas e trilho de auditoria.
   * É o que o deploy espera antes de dar a versão nova como boa. `/health` fica como alias.
   */
  @Get('health/ready')
  ready() {
    return this.check();
  }

  // Hand-rolled — not @nestjs/terminus. Its published dist ships .js.map files
  // that a bug in this workspace's Nx/webpack production build tries to parse
  // as real modules and fails on; terminus was only used here for two simple
  // pings, not worth the broken build for.
  @Get('health')
  async check() {
    const info: Record<string, ComponentStatus> = {};
    const degraded: Record<string, ComponentStatus> = {};
    const error: Record<string, ComponentStatus> = {};

    // Base de dados — dependência CRÍTICA: se estiver em baixo, a API não serve → 503.
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      info['database'] = { status: 'up' };
    } catch {
      error['database'] = { status: 'down' };
    }

    // Redis — dependência NÃO-CRÍTICA: a app é fail-safe sem ele (broadcast socket.io local,
    // throttle em memória, cache-miss). Em baixo → 'degraded' (reportado para observabilidade),
    // mas NUNCA devolve 503: senão um Redis transitoriamente em baixo faria o orquestrador matar/
    // despejar todos os pods ainda funcionais (falha em cascata). Ver DR-RUNBOOK.md §2.
    try {
      if (await this.redis.ping()) info['redis'] = { status: 'up' };
      else degraded['redis'] = { status: 'down' };
    } catch {
      degraded['redis'] = { status: 'down' };
    }

    // OPS-06: uma migração que falhou a meio (ou ficou por terminar) deixa o schema num estado
    // que o código não espera. `prisma migrate deploy` recusa continuar; aqui torna-se visível.
    let ultimaMigracao: string | null = null;
    if (info['database']) {
      try {
        const [m] = await this.prisma.$queryRaw<Array<{ pendentes: number | bigint; ultima: string | null }>>`
          SELECT count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS pendentes,
                 max(migration_name) FILTER (WHERE finished_at IS NOT NULL) AS ultima
          FROM _prisma_migrations`;
        ultimaMigracao = m?.ultima ?? null;
        if (Number(m?.pendentes ?? 0) === 0) info['migrations'] = { status: 'up' };
        else error['migrations'] = { status: 'down' };
      } catch {
        error['migrations'] = { status: 'down' };
      }
    }

    // QA-13: trilho de auditoria. Sem ele as escritas continuam a funcionar, mas sem prova de
    // quem fez o quê — reportado como erro para o alarme disparar (o arranque em produção já
    // recusa sem triggers; isto apanha um trigger removido depois).
    // Em produção é crítico (503); noutros ambientes (CI de carga, dev sem triggers) é degradado.
    const semAuditoria = process.env['NODE_ENV'] === 'production' ? error : degraded;
    try {
      const a = await this.auditoria.verificar();
      if (a.funcao && a.tabelasSemTrigger.length === 0) info['audit'] = { status: 'up' };
      else semAuditoria['audit'] = { status: 'down' };
    } catch {
      semAuditoria['audit'] = { status: 'down' };
    }

    const critico = Object.keys(error).length > 0;
    const status = critico ? ('error' as const) : Object.keys(degraded).length > 0 ? ('degraded' as const) : ('ok' as const);
    const body = {
      status,
      ultimaMigracao,
      info,
      degraded,
      error,
      details: { ...info, ...degraded, ...error },
    };

    // 503 só quando uma dependência crítica (BD) está em baixo; 'degraded' devolve 200.
    if (critico) throw new ServiceUnavailableException(body);
    return body;
  }
}
