const send = jest.fn();
jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send } })) }));

import { MailerService } from './mailer.service';

// QA-21 — módulo sem spec: envio de email (Resend).
describe('MailerService', () => {
  const antes = process.env['RESEND_API_KEY'];
  afterEach(() => { process.env['RESEND_API_KEY'] = antes; send.mockReset(); });

  it('sem RESEND_API_KEY não envia (nem rebenta no arranque)', async () => {
    delete process.env['RESEND_API_KEY'];
    await new MailerService().enviar({ para: 'a@b.pt', assunto: 'x', html: '<p>x</p>' });
    expect(send).not.toHaveBeenCalled();
  });

  it('com chave: normaliza destinatários e anexos', async () => {
    process.env['RESEND_API_KEY'] = 're_teste';
    await new MailerService().enviar({ para: 'a@b.pt', assunto: 'Assunto', html: '<p>x</p>', anexos: [{ nome: 'f.pdf', conteudo: Buffer.from('x') }] });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ['a@b.pt'], subject: 'Assunto', attachments: [{ filename: 'f.pdf', content: Buffer.from('x') }] }));
  });

  it('falha do fornecedor é registada, não propagada (um email nunca derruba uma acção clínica)', async () => {
    process.env['RESEND_API_KEY'] = 're_teste';
    send.mockRejectedValue(new Error('429'));
    await expect(new MailerService().enviar({ para: ['a@b.pt'], assunto: 'x', html: 'x' })).resolves.toBeUndefined();
  });
});
