import { Module } from '@nestjs/common';
import { TicketsModule } from './tickets/tickets.module';
import { SalaEsperaModule } from './sala-espera/sala-espera.module';
import { FaturacaoModule } from './faturacao/faturacao.module';
import { PedidosInternosModule } from './pedidos-internos/pedidos-internos.module';
import { ComunicacaoModule } from './comunicacao/comunicacao.module';
import { IncidentesTIModule } from './incidentes-ti/incidentes-ti.module';
import { PedidosTIModule } from './pedidos-ti/pedidos-ti.module';
import { EquipamentosModule } from './equipamentos/equipamentos.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { FornecedoresModule } from './fornecedores/fornecedores.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RelatoriosModule } from './relatorios/relatorios.module';

const operacionalModules = [
  TicketsModule, SalaEsperaModule, FaturacaoModule, PedidosInternosModule,
  ComunicacaoModule, IncidentesTIModule, PedidosTIModule, EquipamentosModule,
  CatalogoModule, FornecedoresModule,
  DashboardModule, RelatoriosModule,
];

@Module({
  imports: operacionalModules,
  exports: operacionalModules,
})
export class OperacionalModule {}
