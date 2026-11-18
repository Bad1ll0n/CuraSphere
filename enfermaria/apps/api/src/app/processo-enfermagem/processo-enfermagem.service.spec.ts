import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProcessoEnfermagemService } from './processo-enfermagem.service';
import { frequenciaValida, sugerirDiagnosticos } from './sugestoes';

describe('PROD-07 — sugestões a partir das escalas', () => {
  it('Braden/Morse com risco, Barthel ≤ 60, NRS ≥ 3 e dor ≥ 4 sugerem diagnósticos; risco baixo não', () => {
    const s = sugerirDiagnosticos({
      braden: { risco: 'moderado', pontuacao: 14, id: 'b' },
      morse: { risco: 'baixo', pontuacao: 10, id: 'm' },
      barthel: { pontuacao: 40, id: 'ba' },
      nrs2002: { pontuacao: 3, id: 'n' },
      dor: { valor: 6, id: 'sv' },
      ativos: [],
    });
    expect(s.map((x) => x.diagnostico)).toEqual(['Úlcera por pressão', 'Autocuidado: higiene comprometido', 'Ingestão nutricional comprometida', 'Dor']);
    expect(s[0]).toMatchObject({ juizo: 'risco', conjunto: 'Risco de úlcera por pressão', origemRef: 'b' });
  });

  it('não volta a sugerir um diagnóstico já ativo', () => {
    expect(sugerirDiagnosticos({ morse: { risco: 'alto', pontuacao: 60, id: 'm' }, ativos: ['queda'] })).toEqual([]);
  });

  it('frequências: as da prescrição e SOS; texto livre não', () => {
    for (const f of ['8/8h', '3x/dia', '1x/dia', 'SOS', 'q6h']) expect(frequenciaValida(f)).toBe(true);
    for (const f of ['', 'quando calhar', '2x/turno']) expect(frequenciaValida(f)).toBe(false);
  });
});

describe('ProcessoEnfermagemService', () => {
  let prisma: any;
  let svc: ProcessoEnfermagemService;

  beforeEach(() => {
    prisma = {
      doente: { findUnique: jest.fn().mockResolvedValue({ id: 'd1' }) },
      episodioInternamento: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) },
      catalogoCuidados: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(28), findMany: jest.fn().mockResolvedValue([]) },
      conjuntoCuidados: { upsert: jest.fn().mockResolvedValue({}), findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      diagnosticoEnfermagem: {
        findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn((a: any) => Promise.resolve({ id: 'dg1', ...a.data })), update: jest.fn((a: any) => Promise.resolve({ id: a.where.id, ...a.data })),
      },
      intervencaoEnfermagem: { findUnique: jest.fn(), update: jest.fn((a: any) => Promise.resolve(a.data)), updateMany: jest.fn((a: any) => a), findMany: jest.fn().mockResolvedValue([]) },
      execucaoIntervencao: { create: jest.fn((a: any) => Promise.resolve(a.data)) },
      avaliacaoDiagnostico: { create: jest.fn((a: any) => Promise.resolve(a.data)) },
      avaliacaoInicialEnfermagem: {
        findFirst: jest.fn().mockResolvedValue(null), create: jest.fn((a: any) => Promise.resolve({ id: 'a1', ...a.data })), update: jest.fn((a: any) => Promise.resolve({ id: a.where.id, ...a.data })),
      },
      avaliacaoRisco: { findMany: jest.fn().mockResolvedValue([]) },
      escalaClinica: { findMany: jest.fn().mockResolvedValue([]) },
      sinalVital: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    svc = new ProcessoEnfermagemService(prisma);
  });

  it('catálogo base: importação idempotente (upsert) e conta o que foi criado', async () => {
    const r = await svc.importarCatalogoBase();
    expect(r).toMatchObject({ conjuntos: 4, criados: 28 });
    expect(prisma.catalogoCuidados.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
  });

  it('criar diagnóstico com intervenções: valida frequências e grava o doente nas intervenções', async () => {
    await expect(svc.criarDiagnostico('d1', 'u1', { termo: 'Queda', intervencoes: [{ termo: 'Vigiar', frequencia: 'quando der' }] }))
      .rejects.toThrow(BadRequestException);
    const d = await svc.criarDiagnostico('d1', 'u1', { termo: 'Queda', juizo: 'risco', intervencoes: [{ termo: 'Vigiar o risco de queda e o ambiente', frequencia: '1x/dia' }] });
    expect(d).toMatchObject({ termo: 'Queda', juizo: 'risco', episodioId: 'e1', identificadoPorId: 'u1' });
    expect(prisma.diagnosticoEnfermagem.create.mock.calls[0][0].data.intervencoes.create[0]).toMatchObject({ doenteId: 'd1', frequencia: '1x/dia', criadaPorId: 'u1' });
  });

  it('não duplica um diagnóstico ativo; doente inexistente dá 404', async () => {
    prisma.diagnosticoEnfermagem.findFirst.mockResolvedValueOnce({ id: 'x' });
    await expect(svc.criarDiagnostico('d1', 'u1', { termo: 'Queda' })).rejects.toThrow(ConflictException);
    prisma.doente.findUnique.mockResolvedValueOnce(null);
    await expect(svc.criarDiagnostico('d9', 'u1', { termo: 'Queda' })).rejects.toThrow(NotFoundException);
    await expect(svc.criarDiagnostico('d1', 'u1', {})).rejects.toThrow(BadRequestException);
  });

  it('item do catálogo do tipo errado é recusado', async () => {
    prisma.catalogoCuidados.findUnique.mockResolvedValueOnce({ id: 'c1', tipo: 'intervencao', termo: 'X' });
    await expect(svc.criarDiagnostico('d1', 'u1', { catalogoId: 'c1' })).rejects.toThrow(BadRequestException);
  });

  it('aplicar conjunto: cria o que falta e ignora o que já está ativo', async () => {
    prisma.conjuntoCuidados.findUnique.mockResolvedValue({ id: 'cj', nome: 'Pós-op', ativo: true, itens: [
      { diagnostico: 'Dor', juizo: 'presente', intervencoes: [{ termo: 'Avaliar a dor', frequencia: '4/4h' }] },
      { diagnostico: 'Queda', intervencoes: [] },
    ] });
    prisma.diagnosticoEnfermagem.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'ja' });
    expect(await svc.aplicarConjunto('d1', 'u1', 'cj')).toEqual({ conjunto: 'Pós-op', criados: ['Dor'], ignorados: ['Queda'] });
    prisma.conjuntoCuidados.findUnique.mockResolvedValueOnce(null);
    await expect(svc.aplicarConjunto('d1', 'u1', 'x')).rejects.toThrow(NotFoundException);
  });

  it('execução: hora do ato no passado aceite; futuro, > 24 h e "não realizada" sem motivo recusados', async () => {
    prisma.intervencaoEnfermagem.findUnique.mockResolvedValue({ doenteId: 'd1', estado: 'ativa' });
    const haUmaHora = new Date(Date.now() - 3_600_000).toISOString();
    expect(await svc.registarExecucao('i1', 'u1', { executadaEm: haUmaHora })).toMatchObject({ doenteId: 'd1', realizada: true });
    await expect(svc.registarExecucao('i1', 'u1', { executadaEm: new Date(Date.now() + 3_600_000).toISOString() })).rejects.toThrow(BadRequestException);
    await expect(svc.registarExecucao('i1', 'u1', { executadaEm: new Date(Date.now() - 30 * 3_600_000).toISOString() })).rejects.toThrow(BadRequestException);
    await expect(svc.registarExecucao('i1', 'u1', { realizada: false })).rejects.toThrow(BadRequestException);
    expect(await svc.registarExecucao('i1', 'u1', { realizada: false, motivoNaoRealizada: 'Doente em exame' })).toMatchObject({ realizada: false, motivoNaoRealizada: 'Doente em exame' });
    prisma.intervencaoEnfermagem.findUnique.mockResolvedValueOnce({ doenteId: 'd1', estado: 'suspensa' });
    await expect(svc.registarExecucao('i1', 'u1', {})).rejects.toThrow(ConflictException);
  });

  it('encerrar: cancelar exige motivo; reavaliar como "resolvido" encerra o diagnóstico e as intervenções', async () => {
    prisma.diagnosticoEnfermagem.findUnique.mockResolvedValue({ estado: 'ativo' });
    await expect(svc.encerrarDiagnostico('dg1', 'u1', { estado: 'cancelado' })).rejects.toThrow(BadRequestException);
    await svc.avaliarDiagnostico('dg1', 'u1', { evolucao: 'resolvido', nota: 'Pele íntegra' });
    expect(prisma.intervencaoEnfermagem.updateMany).toHaveBeenCalledWith({ where: { diagnosticoId: 'dg1', estado: 'ativa' }, data: { estado: 'concluida' } });
    expect(prisma.diagnosticoEnfermagem.update.mock.calls[0][0].data).toMatchObject({ estado: 'resolvido', encerradoPorId: 'u1' });
    prisma.diagnosticoEnfermagem.findUnique.mockResolvedValueOnce({ estado: 'resolvido' });
    await expect(svc.avaliarDiagnostico('dg1', 'u1', { evolucao: 'igual' })).rejects.toThrow(ConflictException);
  });

  it('alterar intervenção: frequência validada', async () => {
    prisma.intervencaoEnfermagem.findUnique.mockResolvedValue({ id: 'i1' });
    await expect(svc.alterarIntervencao('i1', { frequencia: 'às vezes' })).rejects.toThrow(BadRequestException);
    expect(await svc.alterarIntervencao('i1', { estado: 'suspensa', frequencia: '6/6h' })).toEqual({ estado: 'suspensa', frequencia: '6/6h' });
  });

  it('avaliação inicial: uma por episódio — guardar de novo actualiza', async () => {
    await svc.guardarAvaliacaoInicial('d1', 'u1', { dados: { mobilidade: 'acamado' }, completa: false });
    expect(prisma.avaliacaoInicialEnfermagem.create).toHaveBeenCalled();
    prisma.avaliacaoInicialEnfermagem.findFirst.mockResolvedValueOnce({ id: 'a1' });
    await svc.guardarAvaliacaoInicial('d1', 'u1', { dados: { mobilidade: 'com ajuda' }, completa: true });
    expect(prisma.avaliacaoInicialEnfermagem.update.mock.calls[0][0]).toMatchObject({ where: { id: 'a1' }, data: { completa: true } });
  });

  it('plano: intervenções horárias geram registos devidos/em atraso; SOS não', async () => {
    const agora = new Date('2026-11-18T15:00:00');
    prisma.diagnosticoEnfermagem.findMany.mockResolvedValueOnce([{
      id: 'dg1', termo: 'Úlcera por pressão', juizo: 'risco', origem: 'escala', estado: 'ativo', resultadoEsperado: null,
      identificadoEm: new Date('2026-11-17T08:00:00'), identificadoPor: { nome: 'Enf. Ana' }, avaliacoes: [],
      intervencoes: [
        { id: 'i1', termo: 'Posicionar o doente', frequencia: '3/3h', estado: 'ativa', iniciadaEm: new Date('2026-11-17T08:00:00'), execucoes: [] },
        { id: 'i2', termo: 'Assistir no levante', frequencia: 'SOS', estado: 'ativa', iniciadaEm: new Date('2026-11-17T08:00:00'), execucoes: [] },
      ],
    }]).mockResolvedValueOnce([]);
    const p = await svc.plano('d1', agora);
    expect(p.diagnosticos[0].intervencoes[1].devidas).toEqual([]);
    expect(p.diagnosticos[0].intervencoes[0].devidas.length).toBeGreaterThan(0);
    expect(p.resumo.devidas + p.resumo.emAtraso).toBe(p.diagnosticos[0].intervencoes[0].devidas.filter((d) => d.estado !== 'realizada').length);
  });

  it('resumo do turno por doente', async () => {
    prisma.intervencaoEnfermagem.findMany.mockResolvedValueOnce([
      { doenteId: 'd1', frequencia: '1x/dia', iniciadaEm: new Date('2026-11-01T00:00:00'), execucoes: [] },
    ]);
    const r = await svc.resumoTurno(['d1'], new Date('2026-11-18T10:00:00'));
    expect(r.get('d1')).toBeDefined();
    expect((await svc.resumoTurno([])).size).toBe(0);
  });
});
