import { Module } from '@nestjs/common';
import { UtilizadoresModule } from './utilizadores/utilizadores.module';
import { RhModule } from './rh/rh.module';
import { EspecialidadesModule } from './especialidades/especialidades.module';
import { TurnosModule } from './turnos/turnos.module';
import { HorariosModule } from './horarios/horarios.module';
import { AtribuicoesModule } from './atribuicoes/atribuicoes.module';
import { TrocasModule } from './trocas/trocas.module';
import { EscalasModule } from './escalas/escalas.module';

const gestaoModules = [
  UtilizadoresModule, RhModule, EspecialidadesModule,
  TurnosModule, HorariosModule, AtribuicoesModule, TrocasModule, EscalasModule,
];

@Module({
  imports: gestaoModules,
  exports: gestaoModules,
})
export class GestaoModule {}
