import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditCheckpointService } from './audit-checkpoint.service';

/**
 * Torna o AuditService injetável em toda a app (@Global). Inclui o AuditCheckpointService, que
 * sela periodicamente raízes assinadas sobre os hashes-de-conteúdo (prova tamper-proof).
 */
@Global()
@Module({
  providers: [AuditService, AuditCheckpointService],
  exports: [AuditService, AuditCheckpointService],
})
export class AuditModule {}
