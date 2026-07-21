import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * Torna o AuditService injetável em toda a app (@Global), para que TODOS os escritores de
 * auditoria passem pelo mesmo ponto encadeado por hash — condição para uma cadeia linear e
 * verificável (tamper-evidence).
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
