import { Controller, Get, Res, ServiceUnavailableException } from '@nestjs/common';
import type { Response } from 'express';
import { randomBytes } from 'crypto';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

type ComponentStatus = { status: 'up' | 'down' };

@SkipThrottle()
@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
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
      await this.redis.set('__health__', '1', 5);
      const val = await this.redis.get<string>('__health__');
      if (val === '1') info['redis'] = { status: 'up' };
      else degraded['redis'] = { status: 'down' };
    } catch {
      degraded['redis'] = { status: 'down' };
    }

    const critico = Object.keys(error).length > 0;
    const status = critico ? ('error' as const) : Object.keys(degraded).length > 0 ? ('degraded' as const) : ('ok' as const);
    const body = {
      status,
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
