import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Chave de assinatura das raízes. Em produção TEM de ser definida e guardada FORA da BD
// (secret manager) — é o que impede um DBA de forjar um checkpoint que valide dados adulterados.
const SIGNING_KEY = process.env['AUDIT_SIGNING_KEY'] ?? 'dev-insecure-audit-signing-key-change-me';
// Advisory lock (leader-election): só uma instância sela de cada vez.
const CHECKPOINT_LOCK = 918273646;
const INTERVALO_MS = Number(process.env['AUDIT_CHECKPOINT_MS'] ?? 60_000);
// Janela de segurança: não selar linhas muito recentes (evita a corrida seq vs. ordem-de-commit
// para transações curtas). Rigor total: track_commit_timestamp + watermark por xmin.
const MARGEM_SEG = 60;
const LOTE = 5000;

@Injectable()
export class AuditCheckpointService implements OnModuleDestroy {
  private readonly logger = new Logger(AuditCheckpointService.name);
  private readonly timer: NodeJS.Timeout;
  private aCorrer = false;

  constructor(private readonly prisma: PrismaService) {
    this.timer = setInterval(() => { this.selar().catch(() => { /* logado dentro */ }); }, INTERVALO_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() { clearInterval(this.timer); }

  private static assinar(raiz: string): string {
    return createHmac('sha256', SIGNING_KEY).update(raiz).digest('hex');
  }

  /**
   * Sela um novo checkpoint sobre as linhas de auditoria ainda não seladas (seq > último seqFim)
   * que já estejam "assentes" (mais velhas que a margem). Encadeia os contentHash das linhas numa
   * raiz, encadeia a raiz no checkpoint anterior, e ASSINA — tornando a prova impossível de forjar
   * sem a chave (que vive fora da BD). Leader-elected por advisory-lock: só uma instância sela.
   */
  async selar(): Promise<{ selado: boolean; seqInicio?: number; seqFim?: number; total?: number }> {
    if (this.aCorrer) return { selado: false };
    this.aCorrer = true;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const [{ locked }] = await tx.$queryRawUnsafe<{ locked: boolean }[]>(`SELECT pg_try_advisory_xact_lock(${CHECKPOINT_LOCK}) AS locked`);
        if (!locked) return { selado: false };

        const ultimo = await tx.auditCheckpoint.findFirst({ orderBy: { seqFim: 'desc' } });
        const desde = ultimo?.seqFim ?? 0;

        const rows = await tx.$queryRawUnsafe<{ seq: number; contentHash: string }[]>(
          `SELECT seq, "contentHash" FROM audit_logs
             WHERE seq > $1 AND "contentHash" IS NOT NULL
               AND "createdAt" < now() - interval '${MARGEM_SEG} seconds'
             ORDER BY seq ASC LIMIT ${LOTE}`,
          desde,
        );
        if (rows.length === 0) return { selado: false };

        // Raiz = encadeamento dos hashes-de-conteúdo (a partir da raiz do checkpoint anterior).
        let raiz = ultimo?.raiz ?? '';
        for (const r of rows) raiz = createHash('sha256').update(raiz + '|' + r.contentHash).digest('hex');

        const seqInicio = rows[0].seq;
        const seqFim = rows[rows.length - 1].seq;
        await tx.auditCheckpoint.create({
          data: {
            seqInicio, seqFim, raiz,
            prevCheckpointHash: ultimo?.raiz ?? null,
            assinatura: AuditCheckpointService.assinar(raiz),
            totalEntradas: rows.length,
          },
        });
        this.logger.log(`Checkpoint de auditoria selado: seq ${seqInicio}–${seqFim} (${rows.length} entradas)`);
        return { selado: true, seqInicio, seqFim, total: rows.length };
      });
    } catch (err) {
      this.logger.warn(`Selagem de checkpoint falhou: ${(err as Error)?.message ?? String(err)}`);
      return { selado: false };
    } finally {
      this.aCorrer = false;
    }
  }

  /**
   * Verifica a integridade: recalcula a raiz de cada checkpoint a partir das linhas de auditoria
   * e confirma a assinatura. Deteta qualquer remoção/alteração de linhas seladas (a raiz muda) e
   * qualquer forja de checkpoint (a assinatura não bate).
   */
  async verificar(): Promise<{ ok: boolean; checkpoints: number; primeiraFalha: { seqFim: number; motivo: string } | null }> {
    const checkpoints = await this.prisma.auditCheckpoint.findMany({ orderBy: { seqFim: 'asc' } });
    let prevRaiz = '';
    for (const cp of checkpoints) {
      if ((cp.prevCheckpointHash ?? '') !== prevRaiz) {
        return { ok: false, checkpoints: checkpoints.length, primeiraFalha: { seqFim: cp.seqFim, motivo: 'cadeia de checkpoints quebrada (prevCheckpointHash)' } };
      }
      const rows = await this.prisma.$queryRawUnsafe<{ contentHash: string }[]>(
        `SELECT "contentHash" FROM audit_logs WHERE seq >= $1 AND seq <= $2 AND "contentHash" IS NOT NULL ORDER BY seq ASC`,
        cp.seqInicio, cp.seqFim,
      );
      let raiz = prevRaiz;
      for (const r of rows) raiz = createHash('sha256').update(raiz + '|' + r.contentHash).digest('hex');
      if (raiz !== cp.raiz) {
        return { ok: false, checkpoints: checkpoints.length, primeiraFalha: { seqFim: cp.seqFim, motivo: 'raiz recalculada não bate (linhas removidas/alteradas)' } };
      }
      if (AuditCheckpointService.assinar(cp.raiz) !== cp.assinatura) {
        return { ok: false, checkpoints: checkpoints.length, primeiraFalha: { seqFim: cp.seqFim, motivo: 'assinatura inválida (checkpoint forjado)' } };
      }
      prevRaiz = cp.raiz;
    }
    return { ok: true, checkpoints: checkpoints.length, primeiraFalha: null };
  }
}
