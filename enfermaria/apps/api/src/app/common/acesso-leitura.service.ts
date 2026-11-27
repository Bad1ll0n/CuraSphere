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
  /** SEC-09: 'concedido' | 'negado'. */
  resultado?: string | null;
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
  // SEC-09: ao parar a API (deploy), escreve o que está na fila em vez de o perder.
  async onModuleDestroy() {
    clearInterval(this.timer);
    for (let i = 0; i < 5 && this.fila.length > 0; i++) await this.flush();
  }

  private descartadas = 0;

  registar(e: EntradaLeitura): void {
    if (this.fila.length >= FILA_MAX) {
      // Teto anti-OOM — mas nunca em silêncio: um buraco no trilho tem de ser visível.
      if (++this.descartadas % 1000 === 1) {
        this.logger.error(`Trilho de leituras: fila cheia (${FILA_MAX}) — ${this.descartadas} acesso(s) por registar`);
      }
      return;
    }
    this.fila.push(e);
    if (this.fila.length >= BATCH_MAX && !this.aEscrever) void this.flush();
  }

  /**
   * SEC-09: "quem consultou este processo" — para o DPO e para o titular (art. 15.º RGPD).
   * Com `paraTitular`, não se expõe o IP nem a rota técnica.
   */
  async listarPorDoente(doenteId: string, opts: { pagina?: number; limite?: number; paraTitular?: boolean } = {}) {
    await this.flush(); // o que está na fila também conta
    const limite = Math.min(Math.max(opts.limite ?? 50, 1), 200);
    const pagina = Math.max(opts.pagina ?? 1, 1);
    const where = { entidadeTipo: 'doentes', entidadeId: doenteId };
    const [total, registos] = await Promise.all([
      this.prisma.acessoLeitura.count({ where }),
      this.prisma.acessoLeitura.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limite,
        skip: (pagina - 1) * limite,
        select: {
          createdAt: true, utilizadorNome: true, utilizadorRole: true, resultado: true,
          ...(opts.paraTitular ? {} : { utilizadorId: true, rota: true, ip: true }),
        },
      }),
    ]);
    return { total, pagina, limite, registos };
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
          resultado: e.resultado ?? null,
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
