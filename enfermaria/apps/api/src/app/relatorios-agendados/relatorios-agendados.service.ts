import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../common/pdf.service';
import { MailerService } from '../mailer/mailer.service';

@Injectable()
export class RelatoriosAgendadosService {
  private readonly logger = new Logger(RelatoriosAgendadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly mailer: MailerService,
  ) {}

  @Cron('0 7 * * 1-5')
  async enviarRelatorioPassagemTurno(): Promise<void> {
    if (!(await this.prisma.tryBecomeLeader('relatorio-turno', 3_600_000))) return;
    try {
      const turno = await this.prisma.turno.findFirst({
        where: { dataFim: { lte: new Date() } },
        orderBy: { dataFim: 'desc' },
      });

      if (!turno) {
        this.logger.log('Relatório agendado: nenhum turno concluído encontrado');
        return;
      }

      const pdfBuffer = await this.pdf.gerarRelatorioTurno(turno.id);

      // Destinatários configurados por ambiente (lista separada por vírgulas). O modelo de
      // utilizador não tem email; os relatórios de gestão vão para uma lista de ops definida
      // em RELATORIO_TURNO_EMAILS (ex.: "direcao@hosp.pt,chefia@hosp.pt").
      const emails = (process.env['RELATORIO_TURNO_EMAILS'] ?? '')
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);
      if (emails.length === 0) {
        this.logger.log('Relatório agendado: RELATORIO_TURNO_EMAILS não configurado — sem destinatários');
        return;
      }

      const data = turno.dataFim ? new Date(turno.dataFim).toLocaleDateString('pt-PT') : '';
      await this.mailer.enviar({
        para: emails,
        assunto: `Relatório Passagem de Turno — ${data}`,
        html: `<p>Relatório de passagem de turno do dia <strong>${data}</strong> em anexo.</p><p><small>Enviado automaticamente pelo CuraSphere.</small></p>`,
        anexos: [{ nome: `relatorio-turno-${turno.id}.pdf`, conteudo: pdfBuffer }],
      });

      this.logger.log(`Relatório de turno enviado para ${emails.length} destinatários`);
    } catch (err) {
      this.logger.error('Erro ao enviar relatório agendado', err);
    }
  }
}
