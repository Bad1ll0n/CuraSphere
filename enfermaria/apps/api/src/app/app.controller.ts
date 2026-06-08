import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { randomBytes } from 'crypto';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';
import { RedisHealthIndicator } from './redis/redis.health';

@SkipThrottle()
@Controller()
export class AppController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly prisma: PrismaService,
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

  @Get('health')
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma),
      () => this.redisIndicator.isHealthy('redis'),
    ]);
  }
}
