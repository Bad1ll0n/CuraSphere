import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import type { ServerOptions } from 'socket.io';

// Adaptador socket.io com pub/sub em Redis. Em produção com VÁRIAS instâncias da API, sem isto uma
// mensagem emitida numa instância (ex.: alerta clínico, urgência:update, nota:lock) NÃO chega aos
// clientes ligados a OUTRA instância. O adaptador propaga os broadcasts entre instâncias via Redis.
//
// FAIL-SAFE: se o Redis estiver indisponível, fica-se sem adaptador Redis (broadcast só local →
// multi-instância degradado, mas o WebSocket single-instance funciona SEMPRE). Nunca impede o
// arranque nem parte o tempo-real numa instância só.
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  async connectToRedis(url: string): Promise<void> {
    // retryStrategy desiste ao fim de poucas tentativas → se o Redis estiver em baixo no arranque,
    // connect() REJEITA (em vez de tentar para sempre e pendurar o boot). connectTimeout limita cada
    // tentativa. Uma vez ligado, reconecta em blips transitórios dentro dessas tentativas.
    const opts = {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      retryStrategy: (tentativas: number) => (tentativas > 3 ? null : Math.min(tentativas * 200, 1000)),
    };
    const pubClient = new Redis(url, opts);
    const subClient = pubClient.duplicate();
    // Silenciar erros de ligação (o fail-safe abaixo trata a indisponibilidade).
    pubClient.on('error', () => undefined);
    subClient.on('error', () => undefined);
    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('socket.io: adaptador Redis ativo (broadcast entre instâncias)');
    } catch (e) {
      this.logger.warn(`socket.io sem adaptador Redis (broadcast só local): ${(e as Error)?.message ?? String(e)}`);
      pubClient.disconnect();
      subClient.disconnect();
    }
  }

  override createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}
