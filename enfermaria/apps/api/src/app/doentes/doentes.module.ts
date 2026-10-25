import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DoenteService } from './doentes.service';
import { AcessoDoenteInterceptor } from './acesso-doente.interceptor';
import { VERIFICADOR_ACESSO_DOENTE } from './acesso-doente.token';
import { DoenteController } from './doentes.controller';
import { QuiosqueController } from './quiosque.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfService } from '../common/pdf.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { AiClinicoModule } from '../ai-clinico/ai-clinico.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { BreakGlassModule } from '../break-glass/break-glass.module';

@Module({
  imports: [PrismaModule, NotificacoesModule, AiClinicoModule, WebhooksModule, BreakGlassModule],
  controllers: [DoenteController, QuiosqueController],
  providers: [
    DoenteService,
    PdfService,
    // S-01: global, apesar de declarado aqui — um APP_INTERCEPTOR aplica-se a toda a
    // aplicação seja qual for o módulo que o regista. Fica junto do DoenteService porque
    // é dele que depende, e para não criar outro caminho de importação até ao AppModule.
    { provide: APP_INTERCEPTOR, useClass: AcessoDoenteInterceptor },
    // S-07: o gateway de websockets resolve a verificação por este token, sem importar o
    // DoenteService (ver acesso-doente.token.ts). É a mesma instância, não uma cópia da regra.
    { provide: VERIFICADOR_ACESSO_DOENTE, useExisting: DoenteService },
  ],
  exports: [DoenteService],
})
export class DoenteModule {}
