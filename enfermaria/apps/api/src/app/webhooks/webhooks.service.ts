import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { assertUrlDestinoPublico } from '../common/ssrf-guard';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: { url: string; eventos: string[]; criadoPorId: string }) {
    // Defesa em profundidade: rejeita destinos óbviamente internos já na
    // criação. Isto não substitui a validação em dispatcharEvento, porque a
    // resolução DNS do hostname pode mudar entre o registo e o disparo.
    await assertUrlDestinoPublico(dto.url);
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
        // Revalida o destino em CADA disparo, não apenas na criação: o DNS de
        // um hostname pode mudar entre o registo do webhook e este momento
        // (DNS rebinding), pelo que a validação na criação sozinha não fecha
        // o SSRF. Se o destino resolver para um IP interno/privado, o pedido
        // é bloqueado antes do fetch.
        try {
          await assertUrlDestinoPublico(hook.url);
        } catch (erro) {
          this.logger.warn(`Webhook ${hook.id} bloqueado: destino não permitido (${hook.url})`);
          throw erro;
        }

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
