import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly client = new Resend(process.env['RESEND_API_KEY']);
  private readonly from = `CuraSphere <noreply@${process.env['MAIL_DOMAIN'] ?? 'curasphere.pt'}>`;

  async enviar(opts: {
    para: string | string[];
    assunto: string;
    html: string;
    anexos?: { nome: string; conteudo: Buffer }[];
  }): Promise<void> {
    if (!process.env['RESEND_API_KEY']) {
      this.logger.warn('RESEND_API_KEY não configurado — email ignorado');
      return;
    }
    try {
      await this.client.emails.send({
        from: this.from,
        to: Array.isArray(opts.para) ? opts.para : [opts.para],
        subject: opts.assunto,
        html: opts.html,
        attachments: opts.anexos?.map(a => ({
          filename: a.nome,
          content: a.conteudo,
        })),
      });
    } catch (e) {
      this.logger.error('Falha ao enviar email', e);
    }
  }
}
