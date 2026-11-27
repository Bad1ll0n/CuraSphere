import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VigilanciaModule } from '../vigilancia/vigilancia.module';
import { PassagemIsbarController } from './passagem-isbar.controller';
import { PassagemIsbarService } from './passagem-isbar.service';

/** UX-22 — substitui o RelatorioPassagemTurnoModule (passagem "Pro", sem ISBAR nem receção). */
@Module({
  imports: [PrismaModule, VigilanciaModule],
  controllers: [PassagemIsbarController],
  providers: [PassagemIsbarService],
})
export class PassagemIsbarModule {}
