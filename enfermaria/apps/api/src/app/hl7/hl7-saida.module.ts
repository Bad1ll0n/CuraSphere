import { Module } from '@nestjs/common';
import { Hl7SaidaService } from './hl7-saida.service';

/** PROD-14 — ADT de saída (sem dependências além do Prisma, para os webhooks o poderem usar). */
@Module({
  providers: [Hl7SaidaService],
  exports: [Hl7SaidaService],
})
export class Hl7SaidaModule {}
