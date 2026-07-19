import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { MailerService } from '../mailer/mailer.service';

@Injectable()
export class LembretesService {
  private readonly logger = new Logger(LembretesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
    private readonly mailer: MailerService,
  ) {}

  /** De hora a hora: envia lembrete das consultas nas próximas 24h ainda não lembradas. */
  @Cron('0 * * * *')
  async enviarLembretes() {
    const agora = new Date();
    const em24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
    const consultas = await this.prisma.consulta.findMany({
      where: { estado: 'agendada', lembreteEnviadoEm: null, dataHora: { gte: agora, lte: em24h } },
      include: {
        doente: { select: { nome: true, portalDoente: { select: { email: true } } } },
        medico: { select: { id: true, nome: true } },
      },
    });
    if (!consultas.length) return;

    for (const c of consultas) {
      const nome = c.doente?.nome ?? c.nomeDoente ?? 'Doente';
      const quando = c.dataHora.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
      // Lembrete ao médico (canal fiável — push interno).
      this.notificacoes.enviarParaUtilizador(
        c.medicoId,
        'Consulta nas próximas 24h',
        `${c.especialidade} com ${nome} — ${quando}`,
        { tipo: 'lembrete_consulta', consultaId: c.id },
      ).catch((e) => this.logger.warn('Lembrete push falhou', e?.message ?? String(e)));

      // Lembrete ao doente por email, se tiver conta no portal.
      const email = c.doente?.portalDoente?.email;
      if (email) {
        this.mailer.enviar({
          para: email,
          assunto: 'Lembrete da sua consulta',
          html: `<p>Olá ${nome},</p><p>Lembramos a sua consulta de <b>${c.especialidade}</b> em <b>${quando}</b>${c.tipo === 'teleconsulta' ? ' (teleconsulta)' : ''}.</p><p>Se não puder comparecer, contacte-nos para reagendar.</p><p>— CuraSphere</p>`,
        }).catch((e) => this.logger.warn('Lembrete email falhou', e?.message ?? String(e)));
      }

      await this.prisma.consulta.update({ where: { id: c.id }, data: { lembreteEnviadoEm: new Date() } }).catch(() => null);
    }
    this.logger.log(`Lembretes de consulta enviados: ${consultas.length}`);
  }
}
