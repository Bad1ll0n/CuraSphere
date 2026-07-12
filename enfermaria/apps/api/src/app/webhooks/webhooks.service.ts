import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: { url: string; eventos: string[]; criadoPorId: string }) {
    const secret = crypto.randomBytes(32).toString('hex');
    return this.prisma.webhook.create({ data: { ...dto, secret } });
  }

  async listar() {
    return this.prisma.webhook.findMany({ where: { ativo: true } });
  }

  async remover(id: string) {
    return this.prisma.webhook.update({ where: { id }, data: { ativo: false } });
  }

  async dispatcharEvento(evento: string, payload: Record<string, unknown>) {
    const hooks = await this.prisma.webhook.findMany({
      where: { ativo: true, eventos: { has: evento } },
    });

    await Promise.allSettled(
      hooks.map(async (hook) => {
        const body = JSON.stringify({ evento, payload, timestamp: new Date().toISOString() });
        const sig = crypto.createHmac('sha256', hook.secret).update(body).digest('hex');
        await fetch(hook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CuraSphere-Signature': sig },
          body,
          signal: AbortSignal.timeout(5000),
        });
      }),
    );
  }
}
