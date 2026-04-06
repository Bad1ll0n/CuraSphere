import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UtilizadoresModule } from './utilizadores/utilizadores.module';
import { DoenteModule } from './doentes/doentes.module';
import { CamasModule } from './camas/camas.module';
import { TarefasModule } from './tarefas/tarefas.module';
import { MedicacaoModule } from './medicacao/medicacao.module';
import { TurnosModule } from './turnos/turnos.module';
import { HorariosModule } from './horarios/horarios.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    AuthModule,
    UtilizadoresModule,
    DoenteModule,
    CamasModule,
    TarefasModule,
    MedicacaoModule,
    TurnosModule,
    HorariosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
