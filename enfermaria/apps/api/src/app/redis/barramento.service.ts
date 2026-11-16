import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import Redis from 'ioredis';

/**
 * ARQ-17 / OPS-09 — barramento de eventos entre réplicas da API (Redis pub/sub).
 *
 * Com uma só instância, um `Subject` em memória chegava: o pedido que muda a fila da receção
 * e o browser ligado por SSE estavam no mesmo processo. Com várias réplicas atrás do nginx,
 * o evento nasce numa e o browser pode estar ligado a outra — e nunca o recebe. O mesmo para
 * a invalidação de caches locais (sessões revogadas, feature flags).
 *
 * `publicar` envia para TODAS as réplicas (incluindo a própria, que recebe pelo Redis). Sem
 * Redis (desenvolvimento, ou Redis em baixo), entrega localmente — o comportamento de uma só
 * instância, que é o que havia antes.
 */
@Injectable()
export class BarramentoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BarramentoService.name);
  private readonly local = new EventEmitter();
  private pub: Redis | null = null;
  private sub: Redis | null = null;
  private ligado = false;
  private readonly canais = new Set<string>();

  constructor(private readonly config: ConfigService) {
    this.local.setMaxListeners(100);
  }

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) return; // sem Redis configurado: só local
    this.pub = new Redis(url, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1 });
    this.sub = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null });
    this.sub.on('message', (canal: string, raw: string) => {
      try { this.local.emit(canal, JSON.parse(raw)); } catch { /* mensagem inválida: ignorar */ }
    });
    this.sub.on('ready', () => {
      this.ligado = true;
      if (this.canais.size) void this.sub!.subscribe(...this.canais).catch(() => undefined);
    });
    this.sub.on('error', (e) => {
      if (this.ligado) this.logger.warn(`Barramento sem Redis (eventos ficam locais): ${e.message}`);
      this.ligado = false;
    });
    this.sub.on('end', () => { this.ligado = false; });
    this.pub.connect().catch(() => undefined);
    this.sub.connect().catch(() => undefined);
  }

  async onModuleDestroy() {
    await Promise.allSettled([this.pub?.quit(), this.sub?.quit()]);
  }

  /** Envia `mensagem` a todas as réplicas que subscrevem `canal`. */
  publicar(canal: string, mensagem: unknown): void {
    if (this.ligado && this.pub?.status === 'ready') {
      this.pub.publish(canal, JSON.stringify(mensagem)).catch(() => this.local.emit(canal, mensagem));
      return;
    }
    this.local.emit(canal, mensagem);
  }

  /** Recebe as mensagens de `canal` vindas de qualquer réplica. Devolve a função para cancelar. */
  subscrever<T = unknown>(canal: string, ouvinte: (mensagem: T) => void): () => void {
    this.local.on(canal, ouvinte as (m: unknown) => void);
    if (!this.canais.has(canal)) {
      this.canais.add(canal);
      if (this.ligado) void this.sub?.subscribe(canal).catch(() => undefined);
    }
    return () => this.local.off(canal, ouvinte as (m: unknown) => void);
  }
}
