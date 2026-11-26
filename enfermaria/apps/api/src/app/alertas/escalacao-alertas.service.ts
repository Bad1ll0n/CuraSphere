import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from './alertas.service';

/**
 * ARQ-06 — escalação de alertas urgentes sem resposta há mais de 30 min ao chefe de turno.
 * É uma regra determinística de segurança clínica, sem IA: vivia no serviço de IA e por isso
 * parecia depender dela. Corre sempre, esteja a IA ligada ou não.
 */
@Injectable()
export class EscalacaoAlertasService {
  private readonly logger = new Logger(EscalacaoAlertasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertasService: AlertasService,
  ) {}

  @Cron('*/15 * * * *')
  async escalarAlertasNaoRespondidos(): Promise<void> {
    if (!(await this.prisma.tryBecomeLeader('escalar-alertas', 720_000))) return; // 12min < 15min

    const limite = new Date(Date.now() - 30 * 60_000);

    const alertas = await this.prisma.alertaClinico.findMany({
      where: {
        urgencia: true,
        lido: false,
        escaladoEm: null,
        criadoEm: { lte: limite },
        tipo: { in: ['news2_critico', 'sepsis', 'sos', 'ia_watchdog'] },
      },
      include: {
        doente: {
          select: {
            id: true,
            nome: true,
            cama: { select: { numero: true, quarto: true } },
          },
        },
      },
    });

    if (alertas.length === 0) return;

    const turnoAtivo = await this.prisma.turno.findFirst({
      where: { dataInicio: { lte: new Date() }, dataFim: { gte: new Date() } },
      select: { chefeTurnoId: true },
      orderBy: { dataInicio: 'desc' },
    });

    for (const alerta of alertas) {
      await this.prisma.alertaClinico.update({
        where: { id: alerta.id },
        data: { escaladoEm: new Date() },
      });

      const d = alerta.doente as any;
      const localizacao = d?.cama ? `Quarto ${d.cama.quarto}, Cama ${d.cama.numero}` : '';
      const mensagem = `⬆️ ESCALAÇÃO: Alerta urgente sem resposta há >30min — ${d?.nome ?? 'Doente'} ${localizacao}`.trim();

      await this.alertasService.criarAlerta(d.id, 'escalacao_automatica', mensagem);

      if (turnoAtivo?.chefeTurnoId) {
        await this.prisma.notificacaoInApp.create({
          data: {
            utilizadorId: turnoAtivo.chefeTurnoId,
            titulo: '⬆️ Escalação Automática',
            corpo: mensagem,
            dadosExtra: { tipo: 'escalacao' },
          },
        }).catch(() => { /* notificacaoInApp pode não existir — ignorar */ });
      }

      this.logger.warn(`Escalação automática: doente ${d?.id}, alerta ${alerta.id}`);
    }
  }
}
