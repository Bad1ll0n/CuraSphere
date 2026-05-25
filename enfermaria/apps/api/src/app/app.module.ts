import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
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
import { PrismaHealthIndicator } from '@nestjs/terminus';
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
import { ReconciliacaoModule } from './reconciliacao/reconciliacao.module';
import { ConsentimentosModule } from './consentimentos/consentimentos.module';
import { BreakGlassModule } from './break-glass/break-glass.module';
import { ProtocolosModule } from './protocolos/protocolos.module';
import { DietasModule } from './dietas/dietas.module';
import { RelatoriosModule } from './relatorios/relatorios.module';

@Module({
  imports: [
    // ─── Infra ────────────────────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    TerminusModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    NotificacoesModule,
    GatewayModule,
    ConfiguracoesModule,

    // ─── Gestão de Utilizadores / RH ─────────────────────────────────────────
    UtilizadoresModule,
    RhModule,
    EspecialidadesModule,
    TurnosModule,
    HorariosModule,
    AtribuicoesModule,
    TrocasModule,
    EscalasModule,

    // ─── Clínico — Doente & Cama ──────────────────────────────────────────────
    DoenteModule,
    CamasModule,
    TarefasModule,
    SinaisVitaisModule,
    AlergiasModule,
    ContactosModule,
    AlertasModule,
    NotasClinicasModule,
    EscalasClinicasModule,
    DispositivosInvasivosModule,
    AtosClinicosModule,
    BreakGlassModule,
    ConsentimentosModule,
    EventosAdversosModule,

    // ─── Clínico — Terapêutica & Diagnóstico ─────────────────────────────────
    MedicacaoModule,
    FarmaciaModule,
    ReconciliacaoModule,
    ExamesModule,
    ProtocolosModule,
    DietasModule,

    // ─── Clínico — Serviços Especializados ────────────────────────────────────
    ConsultasModule,
    InterconsultasModule,
    UrgenciaModule,
    BlocoModule,
    FisioterapiaModule,

    // ─── Operacional / Suporte ────────────────────────────────────────────────
    TicketsModule,
    SalaEsperaModule,
    FaturacaoModule,
    PedidosInternosModule,
    ComunicacaoModule,
    IncidentesTIModule,
    PedidosTIModule,
    EquipamentosModule,
    CatalogoModule,
    FornecedoresModule,

    // ─── Analytics ────────────────────────────────────────────────────────────
    DashboardModule,
    RelatoriosModule,
  ],
  controllers: [AppController, AuditController],
  providers: [
    AppService,
    AuditService,
    PrismaHealthIndicator,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
