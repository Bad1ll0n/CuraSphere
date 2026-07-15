import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  // Resend's constructor throws synchronously if given an undefined/empty key —
  // only construct it when the key is actually configured, so this app doesn't
  // crash at boot in environments (like local dev) where email sending is
  // simply not set up. `enviar()` no-ops when `client` is null.
  private readonly client = process.env['RESEND_API_KEY'] ? new Resend(process.env['RESEND_API_KEY']) : null;
  private readonly from = `CuraSphere <noreply@${process.env['MAIL_DOMAIN'] ?? 'curasphere.pt'}>`;

  async enviar(opts: {
    para: string | string[];
    assunto: string;
    html: string;
    anexos?: { nome: string; conteudo: Buffer }[];
  }): Promise<void> {
    if (!this.client) {
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
