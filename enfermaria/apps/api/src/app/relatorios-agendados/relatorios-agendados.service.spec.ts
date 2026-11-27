import { RelatoriosAgendadosService } from './relatorios-agendados.service';

// QA-21 — módulo sem spec. SEC-18: o relatório de turno (dados clínicos de todos os doentes)
// já não segue em anexo por email (subcontratante nos EUA) — só um link para a aplicação.
describe('RelatoriosAgendadosService', () => {
  const antes = { ...process.env };
  afterEach(() => { process.env = { ...antes }; });
  let prisma: any, mailer: any, svc: RelatoriosAgendadosService;
  beforeEach(() => {
    prisma = { tryBecomeLeader: jest.fn().mockResolvedValue(true), turno: { findFirst: jest.fn() } };
    mailer = { enviar: jest.fn() };
    svc = new RelatoriosAgendadosService(prisma, mailer);
  });

  it('só uma instância envia (eleição de líder)', async () => {
    prisma.tryBecomeLeader.mockResolvedValue(false);
    await svc.enviarRelatorioPassagemTurno();
    expect(prisma.turno.findFirst).not.toHaveBeenCalled();
  });

  it('sem destinatários configurados: não envia', async () => {
    delete process.env['RELATORIO_TURNO_EMAILS'];
    prisma.turno.findFirst.mockResolvedValue({ id: 't1', dataFim: new Date() });
    await svc.enviarRelatorioPassagemTurno();
    expect(mailer.enviar).not.toHaveBeenCalled();
  });

  it('SEC-18: envia só um link, sem anexo nem dados de doentes', async () => {
    process.env['RELATORIO_TURNO_EMAILS'] = 'direcao@hosp.pt, chefia@hosp.pt';
    process.env['NEXT_PUBLIC_WEB_URL'] = 'https://curasphere.hosp.pt';
    prisma.turno.findFirst.mockResolvedValue({ id: 't1', dataFim: new Date('2026-11-06T08:00:00Z') });
    await svc.enviarRelatorioPassagemTurno();
    const email = mailer.enviar.mock.calls[0][0];
    expect(email.para).toEqual(['direcao@hosp.pt', 'chefia@hosp.pt']);
    expect(email.anexos).toBeUndefined();
    expect(email.html).toContain('https://curasphere.hosp.pt/turnos');
    expect(email.html).toMatch(/não segue em anexo/);
  });

  it('um erro não derruba o processo (cron)', async () => {
    prisma.turno.findFirst.mockRejectedValue(new Error('BD em baixo'));
    await expect(svc.enviarRelatorioPassagemTurno()).resolves.toBeUndefined();
  });
});
