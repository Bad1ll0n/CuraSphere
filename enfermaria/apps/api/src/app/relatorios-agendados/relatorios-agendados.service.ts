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
    try {
      const turno = await this.prisma.turno.findFirst({
        where: { dataFim: { lte: new Date() } },
        orderBy: { dataFim: 'desc' },
      });

      if (!turno) {
        this.logger.log('Relatório agendado: nenhum turno concluído encontrado');
        return;
      }

      const [pdfBuffer, destinatarios] = await Promise.all([
        this.pdf.gerarRelatorioTurno(turno.id),
        this.prisma.utilizador.findMany({
          where: { ativo: true, role: { in: ['direcao', 'chefe_medicos'] }, email: { not: null } },
          select: { email: true },
        }),
      ]);

      const emails = destinatarios.map(u => u.email as string).filter(Boolean);
      if (emails.length === 0) {
        this.logger.log('Relatório agendado: sem destinatários com email configurado');
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
