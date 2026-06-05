import { Module } from '@nestjs/common';
import { RelatorioPassagemTurnoService } from './relatorio-passagem-turno.service';
import { RelatorioPassagemTurnoController } from './relatorio-passagem-turno.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RelatorioPassagemTurnoController],
  providers: [RelatorioPassagemTurnoService],
  exports: [RelatorioPassagemTurnoService],
})
export class RelatorioPassagemTurnoModule {}
