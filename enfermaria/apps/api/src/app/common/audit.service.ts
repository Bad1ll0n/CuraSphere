import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

interface AuditParams {
  utilizadorId: string;
  acao: string;
  entidadeId?: string | null;
  entidadeTipo?: string | null;
  detalhes?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

interface EntradaFila extends AuditParams {
  createdAt: Date;
}

// Chave arbitrária mas fixa para o advisory-lock global do Postgres que serializa a cadeia.
const AUDIT_LOCK_KEY = 918273645;
// Nº máximo de entradas escritas por lote (uma transação + um lock por lote).
const BATCH_MAX = 500;
// Intervalo do worker que drena a fila.
const FLUSH_MS = 1000;
// Teto de segurança da fila em memória — evita OOM se a BD estiver indisponível.
const FILA_MAX = 50_000;

@Injectable()
export class AuditService implements OnModuleDestroy {
  private readonly logger = new Logger(AuditService.name);
  private fila: EntradaFila[] = [];
  private aEscrever = false;
  private descartadas = 0;
  private readonly timer: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {
    // Worker periódico que drena a fila em lotes. unref → não impede o processo de terminar.
    this.timer = setInterval(this.drenar, FLUSH_MS);
    this.timer.unref?.();
  }

  /** Callback do worker periódico. `flush()` auto-captura erros, por isso não precisa de `.catch`. */
  private readonly drenar = (): void => {
    void this.flush();
  };

  /**
   * Regista uma entrada de auditoria **encadeada por hash** (tamper-evidence), de forma
   * assíncrona e não-bloqueante: apenas coloca a entrada numa fila em memória (operação O(1),
   * sem BD, sem lock). Um worker escreve a fila em **lotes** — adquirindo o advisory-lock UMA
   * vez por lote e fazendo um único `createMany` — o que amortiza o custo do lock e liberta o
   * pool de ligações do caminho do pedido. Isto remove o gargalo de serialização por-entrada.
   *
   * Nota de durabilidade: entradas ainda em fila perdem-se num crash abrupto (SIGKILL/OOM).
   * O flush no shutdown gracioso (SIGTERM) e o intervalo curto limitam a janela; para
   * durabilidade total a fila teria de ser externa (Redis/Kafka).
   */
  registar(params: AuditParams): void {
    if (this.fila.length >= FILA_MAX) {
      this.descartadas++;
      if (this.descartadas % 1000 === 1) this.logger.error(`Fila de auditoria cheia — ${this.descartadas} entradas descartadas (BD indisponível?)`);
      return;
    }
    this.fila.push({
      utilizadorId: params.utilizadorId,
      acao: params.acao,
      entidadeId: params.entidadeId ?? null,
      entidadeTipo: params.entidadeTipo ?? null,
      detalhes: params.detalhes ?? null,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      createdAt: new Date(),
    });
    // Se a fila crescer muito, força um flush já (sem esperar pelo intervalo).
    // flush() auto-captura erros → não precisa de .catch.
    if (this.fila.length >= BATCH_MAX && !this.aEscrever) {
      void this.flush();
    }
  }

  /**
   * Escreve um lote da fila numa única transação: adquire o advisory-lock (serializa entre
   * instâncias), lê o hash da última entrada e encadeia todo o lote em memória antes de um
   * `createMany`. Guardado por `aEscrever` para nunca correrem dois flushes em paralelo (o que
   * partiria a cadeia por lerem o mesmo hash anterior).
   */
  private async flush(): Promise<void> {
    if (this.aEscrever || this.fila.length === 0) return;
    this.aEscrever = true;
    const lote = this.fila.splice(0, BATCH_MAX);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', AUDIT_LOCK_KEY);
        const ultima = await tx.auditLog.findFirst({
          where: { hash: { not: null } },
          orderBy: { seq: 'desc' },
          select: { hash: true },
        });
        let prev = ultima?.hash ?? null;
        const dados = lote.map((e) => {
          const hash = AuditService.calcularHash(e, e.createdAt, prev);
          const row = { ...e, prevHash: prev, hash };
          prev = hash;
          return row;
        });
        await tx.auditLog.createMany({ data: dados });
      }, { timeout: 15000 });
    } catch (err) {
      // Transação atómica → nada foi inserido; repõe o lote à cabeça para nova tentativa.
      this.fila.unshift(...lote);
      this.logger.warn(`Flush de auditoria falhou (${lote.length} entradas re-enfileiradas): ${(err as Error)?.message ?? String(err)}`);
    } finally {
      this.aEscrever = false;
    }
  }

  /** Drena o que resta da fila no shutdown gracioso. */
  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    let tentativas = 0;
    while (this.fila.length > 0 && tentativas < 100) {
      const antes = this.fila.length;
      await this.flush();
      if (this.fila.length >= antes) break; // não está a progredir (BD em baixo) — desiste
      tentativas++;
    }
  }

  /** Conteúdo canónico → sha256. Tem de ser idêntico na escrita e na verificação. */
  private static calcularHash(
    p: Pick<AuditParams, 'utilizadorId' | 'acao' | 'entidadeId' | 'entidadeTipo' | 'detalhes' | 'ip' | 'userAgent'>,
    createdAt: Date,
    prevHash: string | null,
  ): string {
    const canonico = JSON.stringify({
      utilizadorId: p.utilizadorId,
      acao: p.acao,
      entidadeId: p.entidadeId ?? null,
      entidadeTipo: p.entidadeTipo ?? null,
      detalhes: p.detalhes ?? null,
      ip: p.ip ?? null,
      userAgent: p.userAgent ?? null,
      createdAt: createdAt.toISOString(),
      prevHash,
    });
    return createHash('sha256').update(canonico).digest('hex');
  }

  /**
   * Percorre a cadeia por ordem de `seq` e recalcula cada hash, confirmando o encadeamento.
   * Devolve o primeiro ponto quebrado (se existir) — evidência de adulteração.
   */
  async verificarIntegridade(): Promise<{
    ok: boolean;
    totalVerificadas: number;
    primeiraQuebra: { seq: number; motivo: string } | null;
  }> {
    const BATCH = 1000;
    let cursor = 0;
    let prev: string | null = null;
    let total = 0;

    for (;;) {
      const rows = await this.prisma.auditLog.findMany({
        where: { hash: { not: null }, seq: { gt: cursor } },
        orderBy: { seq: 'asc' },
        take: BATCH,
        select: { seq: true, utilizadorId: true, acao: true, entidadeId: true, entidadeTipo: true, detalhes: true, ip: true, userAgent: true, createdAt: true, prevHash: true, hash: true },
      });
      if (rows.length === 0) break;

      for (const r of rows) {
        if ((r.prevHash ?? null) !== prev) {
          return { ok: false, totalVerificadas: total, primeiraQuebra: { seq: r.seq, motivo: 'prevHash não corresponde à entrada anterior (entrada removida/inserida/reordenada)' } };
        }
        const esperado = AuditService.calcularHash(r, r.createdAt, prev);
        if (r.hash !== esperado) {
          return { ok: false, totalVerificadas: total, primeiraQuebra: { seq: r.seq, motivo: 'hash recalculado não corresponde (conteúdo alterado)' } };
        }
        prev = r.hash;
        total++;
      }
      cursor = rows[rows.length - 1].seq;
    }
    return { ok: true, totalVerificadas: total, primeiraQuebra: null };
  }
}
