import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AltaService, requisitosConfigurados } from './alta.service';

// PROD-12 — alta única: requisitos (gates), reconciliação por linha, encerramento do internamento.
describe('AltaService', () => {
  let tx: any, prisma: any, svc: AltaService;
  const notificacoes = { enviarParaRole: jest.fn().mockResolvedValue(undefined), enviarParaUtilizador: jest.fn().mockResolvedValue(undefined) };
  const ai = { gerarCartaAlta: jest.fn().mockResolvedValue(undefined), calcularRiscoReadmissao: jest.fn().mockResolvedValue(undefined) };
  const webhooks = { dispatcharEvento: jest.fn().mockResolvedValue(undefined) };
  const medico = { sub: 'med-1', role: 'medico' };
  const base = { motivoAlta: 'melhoria', destino: 'domicilio', resumoClinical: 'Evolução favorável' };
  const ativas = [
    { id: 'm1', nome: 'Amoxicilina', dose: '500 mg', via: 'oral', frequencia: '8/8h' },
    { id: 'm2', nome: 'Enoxaparina', dose: '40 mg', via: 'sc', frequencia: '1x/dia' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['ALTA_REQUISITOS'];
    tx = {
      doente: { findUnique: jest.fn().mockResolvedValue({ id: 'd1', nome: 'Ana', ativo: true, camaId: 'c1' }), update: jest.fn() },
      episodioInternamento: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ep-1', numero: 1, estado: 'ativo', dataAdmissao: new Date('2026-11-01') }),
        update: jest.fn(({ where, data }: any) => Promise.resolve({ id: where.id, ...data })),
      },
      medicacao: { findMany: jest.fn().mockResolvedValue(ativas), updateMany: jest.fn(), findFirst: jest.fn() },
      notaAltaEnfermagem: { findUnique: jest.fn().mockResolvedValue({ id: 'n1' }) },
      planoAlta: { findUnique: jest.fn().mockResolvedValue(null) },
      reconciliacaoAltaLinha: { createMany: jest.fn() },
      sumarioAlta: { create: jest.fn(({ data }: any) => Promise.resolve({ id: 's1', ...data })) },
      tarefa: { updateMany: jest.fn() },
      atribuicaoDoente: { deleteMany: jest.fn() },
      atribuicaoHorarioTurno: { deleteMany: jest.fn() },
      cama: { update: jest.fn() },
      followUpAgendado: { createMany: jest.fn() },
    };
    prisma = { ...tx, $transaction: jest.fn((fn: any) => fn(tx)) };
    svc = new AltaService(prisma, notificacoes as any, ai as any, webhooks as any);
  });

  const reconciliacaoCompleta = [{ medicacaoId: 'm1', decisao: 'manter' }, { medicacaoId: 'm2', decisao: 'suspender', notas: 'profilaxia só no internamento' }];

  it('requisitos por omissão: reconciliação e nota de enfermagem; configuráveis', () => {
    expect(requisitosConfigurados()).toEqual(['reconciliacao', 'nota_enfermagem']);
    process.env['ALTA_REQUISITOS'] = 'plano, lixo';
    expect(requisitosConfigurados()).toEqual(['plano']);
  });

  it('só os papéis com alta; não dá alta a quem já teve', async () => {
    await expect(svc.darAlta('d1', { sub: 'e1', role: 'enfermeiro' }, base as any)).rejects.toThrow(ForbiddenException);
    tx.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: false });
    await expect(svc.darAlta('d1', medico, base as any)).rejects.toThrow(/já teve alta/);
  });

  it('sem decisão para uma prescrição activa nem nota de enfermagem → 409 ALTA_INCOMPLETA com a lista', async () => {
    tx.notaAltaEnfermagem.findUnique.mockResolvedValue(null);
    const r = svc.darAlta('d1', medico, { ...base, reconciliacao: [{ medicacaoId: 'm1', decisao: 'manter' }] } as any);
    await expect(r).rejects.toThrow(ConflictException);
    await expect(svc.darAlta('d1', medico, { ...base, reconciliacao: [{ medicacaoId: 'm1', decisao: 'manter' }] } as any))
      .rejects.toThrow(/Enoxaparina.*nota de alta de enfermagem/);
    expect(tx.sumarioAlta.create).not.toHaveBeenCalled();
  });

  it('com justificação sai, e o que faltou fica no sumário', async () => {
    tx.notaAltaEnfermagem.findUnique.mockResolvedValue(null);
    const s = await svc.darAlta('d1', medico, { ...base, reconciliacao: reconciliacaoCompleta, justificacaoRequisitos: 'Alta urgente a pedido da família' } as any);
    expect(s).toMatchObject({ requisitosEmFalta: ['nota de alta de enfermagem por registar'], justificacaoRequisitos: 'Alta urgente a pedido da família' });
  });

  it('óbito não exige requisitos nem agenda follow-ups', async () => {
    tx.notaAltaEnfermagem.findUnique.mockResolvedValue(null);
    await svc.darAlta('d1', medico, { motivoAlta: 'obito', resumoClinical: 'Óbito' } as any);
    expect(tx.sumarioAlta.create).toHaveBeenCalled();
    expect(tx.followUpAgendado.createMany).not.toHaveBeenCalled();
    expect(ai.gerarCartaAlta).not.toHaveBeenCalled();
  });

  it('reconciliação inválida: prescrição alheia, "nova" de algo já prescrito, nova sem nome', async () => {
    await expect(svc.darAlta('d1', medico, { ...base, reconciliacao: [...reconciliacaoCompleta, { medicacaoId: 'outra', decisao: 'manter' }] } as any))
      .rejects.toThrow(BadRequestException);
    await expect(svc.darAlta('d1', medico, { ...base, reconciliacao: [{ medicacaoId: 'm1', decisao: 'nova' }, { medicacaoId: 'm2', decisao: 'manter' }] } as any))
      .rejects.toThrow(/já está prescrito/);
    await expect(svc.darAlta('d1', medico, { ...base, reconciliacao: [...reconciliacaoCompleta, { decisao: 'nova' }] } as any))
      .rejects.toThrow(/nome do medicamento novo/);
  });

  it('alta completa: fecha o episódio, gera a prescrição de saída e encerra prescrições, tarefas, atribuições e cama', async () => {
    const s = await svc.darAlta('d1', medico, {
      ...base,
      reconciliacao: [...reconciliacaoCompleta, { decisao: 'nova', nome: 'Paracetamol', dose: '1 g', via: 'oral', frequencia: 'SOS' }],
    } as any);
    expect(tx.episodioInternamento.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ep-1' }, data: expect.objectContaining({ estado: 'alta', motivoAlta: 'melhoria' }) }));
    expect(tx.reconciliacaoAltaLinha.createMany.mock.calls[0][0].data).toHaveLength(3);
    expect(s.prescricaoSaida).toBe([
      'Amoxicilina 500 mg oral 8/8h',
      '[NOVO] Paracetamol 1 g oral SOS',
      '[SUSPENSO] Enoxaparina — profilaxia só no internamento',
    ].join('\n'));
    expect(tx.medicacao.updateMany).toHaveBeenCalledWith({ where: { doenteId: 'd1', ativo: true, deletedAt: null }, data: { ativo: false, terminadoEm: expect.any(Date) } });
    expect(tx.tarefa.updateMany).toHaveBeenCalledWith({ where: { doenteId: 'd1', estado: { in: ['pendente', 'em_progresso'] } }, data: { estado: 'cancelada' } });
    expect(tx.atribuicaoDoente.deleteMany).toHaveBeenCalled();
    expect(tx.doente.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ativo: false, camaId: null }) }));
    expect(tx.cama.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { estado: 'em_limpeza' } });
  });

  it('follow-ups vão para o médico que deu a alta — ou, se não for médico, para quem prescreveu por último', async () => {
    expect(await svc.medicoResponsavel('d1', medico, null)).toBe('med-1');
    tx.medicacao.findFirst.mockResolvedValue({ prescritoPorId: 'med-9' });
    expect(await svc.medicoResponsavel('d1', { sub: 'adm-1', role: 'administrativo' }, new Date())).toBe('med-9');
    tx.medicacao.findFirst.mockResolvedValue(null);
    expect(await svc.medicoResponsavel('d1', { sub: 'adm-1', role: 'administrativo' }, null)).toBeNull();
  });
});
