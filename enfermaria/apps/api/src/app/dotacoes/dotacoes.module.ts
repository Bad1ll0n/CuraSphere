import { Module } from '@nestjs/common';
import { DotacoesService } from './dotacoes.service';
import { DotacoesController } from './dotacoes.controller';

/** PROD-17 — dotação segura por serviço e turno. */
@Module({
  controllers: [DotacoesController],
  providers: [DotacoesService],
  exports: [DotacoesService],
})
export class DotacoesModule {}
