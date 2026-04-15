import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }]),
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
  ],
  controllers: [AppController, AuditController],
  providers: [
    AppService,
    AuditService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
