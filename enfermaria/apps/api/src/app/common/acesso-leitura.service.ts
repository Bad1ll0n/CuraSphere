import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EntradaLeitura {
  utilizadorId?: string | null;
  utilizadorNome?: string | null;
  utilizadorRole?: string | null;
  entidadeTipo: string;
  entidadeId?: string | null;
  rota?: string | null;
  ip?: string | null;
  correlationId?: string | null;
}

const FLUSH_MS = 2000;
const BATCH_MAX = 1000;
const FILA_MAX = 100_000;

/**
 * Trilho de ACESSOS (leituras) de dados sensíveis — quem viu que ficha, quando. Escrito de forma
 * ASSÍNCRONA e em LOTE para uma tabela SEPARADA (acessos_leitura), fora do caminho do pedido, para
 * não penalizar a performance das leituras. Não é encadeado (menos crítico que o audit de escritas;
 * uma perda no crash é aceitável — decisão explícita, ao contrário das escritas que são atómicas).
 */
@Injectable()
export class AcessoLeituraService implements OnModuleDestroy {
  private readonly logger = new Logger(AcessoLeituraService.name);
  private fila: EntradaLeitura[] = [];
  private aEscrever = false;
  private readonly timer: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {
    this.timer = setInterval(() => { this.flush().catch(() => { /* logado dentro */ }); }, FLUSH_MS);
    this.timer.unref?.();
  }
  onModuleDestroy() { clearInterval(this.timer); }

  registar(e: EntradaLeitura): void {
    if (this.fila.length >= FILA_MAX) return; // teto anti-OOM
    this.fila.push(e);
    if (this.fila.length >= BATCH_MAX && !this.aEscrever) void this.flush();
  }

  private async flush(): Promise<void> {
    if (this.aEscrever || this.fila.length === 0) return;
    this.aEscrever = true;
    const lote = this.fila.splice(0, BATCH_MAX);
    try {
      await this.prisma.acessoLeitura.createMany({
        data: lote.map((e) => ({
          utilizadorId: e.utilizadorId ?? null,
          utilizadorNome: e.utilizadorNome ?? null,
          utilizadorRole: e.utilizadorRole ?? null,
          entidadeTipo: e.entidadeTipo,
          entidadeId: e.entidadeId ?? null,
          rota: e.rota ?? null,
          ip: e.ip ?? null,
          correlationId: e.correlationId ?? null,
        })),
      });
    } catch (err) {
      this.fila.unshift(...lote); // repõe para nova tentativa
      this.logger.warn(`Flush de acessos-leitura falhou (${lote.length} repostos): ${(err as Error)?.message ?? String(err)}`);
    } finally {
      this.aEscrever = false;
    }
  }
}
