import { limparLinha, modelosDoTitular, recolherDadosDoTitular } from './exportacao-titular';
import { NOME_ANONIMIZADO, RgpdService, politicaRetencao } from './rgpd.service';

const campo = (name: string, kind = 'scalar') => ({ name, kind, type: 'String' });

describe('exportação do titular (SEC-20)', () => {
  const modelos = {
    Doente: { fields: [campo('id'), campo('nome')] },
    SinalVital: { fields: [campo('id'), campo('doenteId')] },
    Alergia: { fields: [campo('id'), campo('doenteId')] },
    PortalDoente: { fields: [campo('id'), campo('doenteId'), campo('passwordHash')] },
    AcessoLeitura: { fields: [campo('id'), campo('doenteId')] },
    Cama: { fields: [campo('id'), campo('doente', 'object')] },
  };

  it('entram todos os modelos com doenteId, menos credenciais e tráfego técnico', () => {
    expect(modelosDoTitular(modelos)).toEqual(['Alergia', 'SinalVital']);
  });

  it('retira hashes, tokens, índices cegos e o tenant', () => {
    expect(limparLinha({ id: '1', nome: 'Ana', nomeBusca: ' a ', nifBusca: 'x', accessTokenHash: 'h', tenantId: 't', nota: 'ok' }))
      .toEqual({ id: '1', nome: 'Ana', nota: 'ok' });
  });

  it('recolhe as linhas de cada tabela, e uma tabela que falha não estraga a exportação', async () => {
    const prisma: any = {
      _runtimeDataModel: { models: modelos },
      doente: { findUnique: jest.fn().mockResolvedValue({ id: 'd1', nome: 'Ana Silva', nomeBusca: ' t1 ' }) },
      sinalVital: { findMany: jest.fn().mockResolvedValue([{ id: 's1', doenteId: 'd1' }]) },
      alergia: { findMany: jest.fn().mockRejectedValue(new Error('boom')) },
    };
    const r = await recolherDadosDoTitular(prisma, 'd1');
    expect(r.titular).toEqual({ id: 'd1', nome: 'Ana Silva' });
    expect(r.dados).toEqual({ SinalVital: [{ id: 's1', doenteId: 'd1' }] });
    expect(r.incompletas).toEqual(['Alergia']);
    expect(prisma.sinalVital.findMany).toHaveBeenCalledWith({ where: { doenteId: 'd1' } });
  });
});

describe('RgpdService — retenção e anonimização (SEC-20)', () => {
  const agora = new Date('2026-11-20T12:00:00Z');
  let prisma: any;
  let audit: any;
  let notif: any;
  let service: RgpdService;

  beforeEach(() => {
    const um = () => ({ updateMany: jest.fn().mockResolvedValue({ count: 1 }), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) });
    prisma = {
      doente: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
      ficheiroPessoalDoente: um(), contactoEmergencia: um(), consulta: um(), listaEspera: um(), acessoFamiliar: um(), portalDoente: um(),
      ticket: um(), checkinSalaEspera: um(),
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
      tryBecomeLeader: jest.fn().mockResolvedValue(true),
    };
    audit = { registar: jest.fn() };
    notif = { enviarParaRole: jest.fn().mockResolvedValue(undefined) };
    service = new RgpdService(prisma, audit, notif, { listarPorDoente: jest.fn().mockResolvedValue([]) } as any);
    delete process.env['ANONIMIZACAO_AUTOMATICA'];
  });

  it('política por omissão: 20 anos, 30 dias, sem anonimização automática', () => {
    expect(politicaRetencao({} as any)).toEqual({ anosProcessoClinico: 20, diasDadosQuiosque: 30, anonimizacaoAutomatica: false });
    expect(politicaRetencao({ RETENCAO_PROCESSO_ANOS: '10', ANONIMIZACAO_AUTOMATICA: 'true' } as any).anosProcessoClinico).toBe(10);
  });

  it('não anonimiza dentro do prazo, um doente ativo, nem sem motivo', async () => {
    prisma.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: false, dataAlta: new Date('2015-01-01'), anonimizadoEm: null });
    await expect(service.anonimizar('d1', 'dpo', 'Fim do prazo legal de retenção', agora)).rejects.toThrow(/prazo de retenção/);
    prisma.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: true, dataAlta: new Date('2000-01-01'), anonimizadoEm: null });
    await expect(service.anonimizar('d1', 'dpo', 'Fim do prazo legal de retenção', agora)).rejects.toThrow(/prazo de retenção/);
    prisma.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: false, dataAlta: new Date('2000-01-01'), anonimizadoEm: null });
    await expect(service.anonimizar('d1', 'dpo', 'curto', agora)).rejects.toThrow(/motivo/);
  });

  it('fora do prazo: anonimiza a identificação (não o conteúdo clínico), apaga credenciais e audita', async () => {
    prisma.doente.findUnique.mockResolvedValue({ id: 'd1234567-aaaa', ativo: false, dataAlta: new Date('2000-01-01'), anonimizadoEm: null, dataNascimento: new Date('1950-06-15T00:00:00Z') });
    await service.anonimizar('d1234567-aaaa', 'dpo', 'Fim do prazo legal de retenção', agora);
    const dados = prisma.doente.update.mock.calls[0][0].data;
    expect(dados).toMatchObject({ nome: NOME_ANONIMIZADO, numeroProcesso: 'ANON-d1234567', identificadorHis: null, fotoUrl: null, anonimizadoEm: agora });
    expect(dados.dataNascimento.toISOString()).toBe('1950-01-01T00:00:00.000Z');
    expect(dados).not.toHaveProperty('diagnosticoPrincipal');
    expect(prisma.ficheiroPessoalDoente.updateMany.mock.calls[0][0].data).toMatchObject({ nif: null, nifBusca: null, numeroSNS: null, morada: null, telefone: null, email: null });
    expect(prisma.portalDoente.deleteMany).toHaveBeenCalledWith({ where: { doenteId: 'd1234567-aaaa' } });
    expect(prisma.acessoFamiliar.deleteMany).toHaveBeenCalled();
    expect(audit.registar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'RGPD_TITULAR_ANONIMIZADO', utilizadorId: 'dpo' }));
  });

  it('um processo já anonimizado não se anonimiza outra vez', async () => {
    prisma.doente.findUnique.mockResolvedValue({ id: 'd1', anonimizadoEm: new Date() });
    await expect(service.anonimizar('d1', 'dpo', 'Fim do prazo legal de retenção', agora)).rejects.toThrow(/já foi anonimizado/);
  });

  it('retenção diária: limpa o quiosque e só avisa o DPO (sem anonimizar) por omissão', async () => {
    prisma.doente.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const r = await service.aplicarRetencao(agora);
    expect(r).toEqual({ quiosque: 2, elegiveis: 2, anonimizados: 0 });
    expect(prisma.ticket.updateMany.mock.calls[0][0].data).toEqual({ nomeUtente: null, telefone: null });
    expect(prisma.ticket.updateMany.mock.calls[0][0].where.criadoEm.lt.toISOString()).toBe('2026-10-21T12:00:00.000Z');
    expect(notif.enviarParaRole).toHaveBeenCalledWith('qualidade', expect.any(String), expect.stringContaining('2 processo'), expect.any(Object));
    expect(prisma.doente.update).not.toHaveBeenCalled();
  });

  it('elegíveis: inativos, com alta antes do prazo e ainda não anonimizados', async () => {
    await service.elegiveis(agora);
    const where = prisma.doente.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ anonimizadoEm: null, ativo: false });
    expect(where.dataAlta.lt.toISOString()).toBe('2006-11-20T12:00:00.000Z');
  });
});
