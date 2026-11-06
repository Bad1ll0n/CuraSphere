import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditCheckpointService } from './audit-checkpoint.service';
import { AcessoLeituraService } from './acesso-leitura.service';
import { AuditoriaInstaladaService } from './auditoria-instalada.service';

/**
 * @Global. AuditService (eventos não-escrita), AuditCheckpointService (prova tamper-proof) e
 * AcessoLeituraService (trilho de leituras sensíveis, assíncrono).
 */
@Global()
@Module({
  providers: [AuditService, AuditCheckpointService, AcessoLeituraService, AuditoriaInstaladaService],
  exports: [AuditService, AuditCheckpointService, AcessoLeituraService, AuditoriaInstaladaService],
})
export class AuditModule {}
