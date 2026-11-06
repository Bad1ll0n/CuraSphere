import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Tabelas clínicas que têm OBRIGATORIAMENTE de ter o trigger de auditoria. */
export const TABELAS_AUDITORIA_OBRIGATORIA = [
  'doentes', 'utilizadores', 'medicacoes', 'registos_medicacao', 'alergias', 'notas_clinicas',
  'sinais_vitais', 'sumarios_alta', 'consentimentos_informados',
];

export interface EstadoAuditoria {
  funcao: boolean;
  tabelasSemTrigger: string[];
}

/**
 * QA-13 — a auditoria de escritas vive em triggers instalados por um script à parte
 * (`scripts/apply-audit-triggers.mjs`, corrido pelo serviço `migrate`). Numa BD onde esse
 * passo falhou ou foi esquecido, a app escrevia sem trilho nenhum e ninguém dava por isso
 * (a BD de dev da revisão tinha 0 triggers).
 *
 * No arranque verifica-se a função e os triggers nas tabelas clínicas obrigatórias:
 * em produção, a API RECUSA ARRANCAR sem eles; fora de produção, erro alto no log.
 * O estado fica disponível para o health check (`audit: down`).
 */
@Injectable()
export class AuditoriaInstaladaService implements OnModuleInit {
  private readonly logger = new Logger(AuditoriaInstaladaService.name);
  private ultimo: EstadoAuditoria | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async verificar(): Promise<EstadoAuditoria> {
    const [{ n }] = await this.prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'curasphere_fn_audit'`;
    const comTrigger = await this.prisma.$queryRaw<Array<{ tabela: string }>>`
      SELECT DISTINCT c.relname AS tabela
        FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
       WHERE t.tgname = 'curasphere_audit' AND NOT t.tgisinternal`;
    const existentes = new Set(comTrigger.map((r) => r.tabela));
    this.ultimo = {
      funcao: n > 0,
      tabelasSemTrigger: TABELAS_AUDITORIA_OBRIGATORIA.filter((t) => !existentes.has(t)),
    };
    return this.ultimo;
  }

  get estado(): EstadoAuditoria | null {
    return this.ultimo;
  }

  async onModuleInit(): Promise<void> {
    let e: EstadoAuditoria;
    try {
      e = await this.verificar();
    } catch (err) {
      this.logger.error(`Não foi possível verificar os triggers de auditoria: ${(err as Error)?.message ?? err}`);
      return; // sem BD a API já falha por outros motivos; não mascarar o erro real
    }
    if (e.funcao && e.tabelasSemTrigger.length === 0) {
      this.logger.log('Auditoria de escritas instalada (função e triggers presentes).');
      return;
    }
    const msg =
      `AUDITORIA DE ESCRITAS INCOMPLETA — função ${e.funcao ? 'presente' : 'EM FALTA'}; ` +
      `tabelas sem trigger: ${e.tabelasSemTrigger.join(', ') || 'nenhuma'}. ` +
      'Correr: node scripts/apply-audit-triggers.mjs (o serviço `migrate` fá-lo em cada deploy).';
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(msg); // recusa arrancar: escrever sem trilho num sistema clínico não é opção
    }
    this.logger.error(msg);
  }
}
