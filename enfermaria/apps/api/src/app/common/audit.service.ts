import { Injectable, Logger } from '@nestjs/common';
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

// Chave arbitrária mas fixa para o advisory-lock global do Postgres que serializa a cadeia.
const AUDIT_LOCK_KEY = 918273645;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Regista uma entrada de auditoria **encadeada por hash** (tamper-evidence).
   * Fire-and-forget — não bloqueia a resposta. A escrita corre numa transação curta que
   * adquire um advisory-lock global, lê o hash da última entrada e insere a nova com
   * `prevHash` + `hash = sha256(conteúdo canónico + prevHash)`. O lock garante uma cadeia
   * linear mesmo com escritores concorrentes; qualquer remoção/alteração/reordenação de uma
   * entrada parte a verificação a partir desse ponto.
   */
  registar(params: AuditParams): void {
    this.escreverEncadeado(params).catch((err) =>
      this.logger.warn(`Audit falhou (não bloqueante): ${err?.message ?? String(err)}`),
    );
  }

  private async escreverEncadeado(p: AuditParams): Promise<void> {
    const createdAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Serializa a cadeia: só um insert de audit progride de cada vez.
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', AUDIT_LOCK_KEY);
      const ultima = await tx.auditLog.findFirst({
        where: { hash: { not: null } },
        orderBy: { seq: 'desc' },
        select: { hash: true },
      });
      const prevHash = ultima?.hash ?? null;
      const hash = AuditService.calcularHash(p, createdAt, prevHash);
      await tx.auditLog.create({
        data: {
          utilizadorId: p.utilizadorId,
          acao: p.acao,
          entidadeId: p.entidadeId ?? null,
          entidadeTipo: p.entidadeTipo ?? null,
          detalhes: p.detalhes ?? null,
          ip: p.ip ?? null,
          userAgent: p.userAgent ?? null,
          createdAt,
          prevHash,
          hash,
        },
      });
    }, { timeout: 8000 });
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
