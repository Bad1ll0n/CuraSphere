import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UtilizadoresModule } from './utilizadores/utilizadores.module';
import { DoenteModule } from './doentes/doentes.module';
import { CamasModule } from './camas/camas.module';
import { TarefasModule } from './tarefas/tarefas.module';
import { MedicacaoModule } from './medicacao/medicacao.module';
import { TurnosModule } from './turnos/turnos.module';
import { HorariosModule } from './horarios/horarios.module';
import { AtribuicoesModule } from './atribuicoes/atribuicoes.module';
import { TrocasModule } from './trocas/trocas.module';
import { SinaisVitaisModule } from './sinais-vitais/sinais-vitais.module';
import { AlergiasModule } from './alergias/alergias.module';
import { ContactosModule } from './contactos/contactos.module';
import { AlertasModule } from './alertas/alertas.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditService } from './common/audit.service';
import { AuditController } from './common/audit.controller';
import { AuditInterceptor } from './common/audit.interceptor';
import { EscalasModule } from './escalas/escalas.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ExamesModule } from './exames/exames.module';
import { UrgenciaModule } from './urgencia/urgencia.module';
import { BlocoModule } from './bloco/bloco.module';
import { ConsultasModule } from './consultas/consultas.module';
import { FarmaciaModule } from './farmacia/farmacia.module';
import { FisioterapiaModule } from './fisioterapia/fisioterapia.module';
import { PedidosInternosModule } from './pedidos-internos/pedidos-internos.module';
import { ComunicacaoModule } from './comunicacao/comunicacao.module';
import { NotasClinicasModule } from './notas-clinicas/notas-clinicas.module';
import { EscalasClinicasModule } from './escalas-clinicas/escalas-clinicas.module';
import { InterconsultasModule } from './interconsultas/interconsultas.module';
import { DispositivosInvasivosModule } from './dispositivos-invasivos/dispositivos-invasivos.module';
import { SalaEsperaModule } from './sala-espera/sala-espera.module';
import { IncidentesTIModule } from './incidentes-ti/incidentes-ti.module';
import { PedidosTIModule } from './pedidos-ti/pedidos-ti.module';
import { ConfiguracoesModule } from './configuracoes/configuracoes.module';
import { FaturacaoModule } from './faturacao/faturacao.module';
import { TicketsModule } from './tickets/tickets.module';
import { EquipamentosModule } from './equipamentos/equipamentos.module';
import { AtosClinicosModule } from './atos-clinicos/atos-clinicos.module';
import { RhModule } from './rh/rh.module';
import { EspecialidadesModule } from './especialidades/especialidades.module';
import { EventosAdversosModule } from './eventos-adversos/eventos-adversos.module';
import { GatewayModule } from './gateway/gateway.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { FornecedoresModule } from './fornecedores/fornecedores.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    UtilizadoresModule,
    DoenteModule,
    CamasModule,
    TarefasModule,
    MedicacaoModule,
    TurnosModule,
    HorariosModule,
    AtribuicoesModule,
    TrocasModule,
    SinaisVitaisModule,
    AlergiasModule,
    ContactosModule,
    AlertasModule,
    NotificacoesModule,
    EscalasModule,
    DashboardModule,
    ExamesModule,
    UrgenciaModule,
    BlocoModule,
    ConsultasModule,
    FarmaciaModule,
    FisioterapiaModule,
    PedidosInternosModule,
    ComunicacaoModule,
    NotasClinicasModule,
    EscalasClinicasModule,
    InterconsultasModule,
    DispositivosInvasivosModule,
    SalaEsperaModule,
    IncidentesTIModule,
    PedidosTIModule,
    ConfiguracoesModule,
    FaturacaoModule,
    TicketsModule,
    EquipamentosModule,
    AtosClinicosModule,
    RhModule,
    EspecialidadesModule,
    EventosAdversosModule,
    GatewayModule,
    CatalogoModule,
    FornecedoresModule,
  ],
  controllers: [AppController, AuditController],
  providers: [
    AppService,
    AuditService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
