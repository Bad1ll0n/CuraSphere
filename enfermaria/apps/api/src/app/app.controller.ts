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
    const error: Record<string, ComponentStatus> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      info['database'] = { status: 'up' };
    } catch {
      error['database'] = { status: 'down' };
    }

    try {
      await this.redis.set('__health__', '1', 5);
      const val = await this.redis.get<string>('__health__');
      if (val === '1') info['redis'] = { status: 'up' };
      else error['redis'] = { status: 'down' };
    } catch {
      error['redis'] = { status: 'down' };
    }

    const body = {
      status: Object.keys(error).length === 0 ? ('ok' as const) : ('error' as const),
      info,
      error,
      details: { ...info, ...error },
    };

    if (body.status === 'error') throw new ServiceUnavailableException(body);
    return body;
  }
}
