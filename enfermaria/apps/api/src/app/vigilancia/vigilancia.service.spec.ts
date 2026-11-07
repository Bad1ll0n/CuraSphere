import { VigilanciaService } from './vigilancia.service';

// PROD-10 — "em atraso" compara o que cada registo fixou com o relógio.
describe('VigilanciaService', () => {
  const H = 3_600_000;
  const agora = Date.now();
  const linha = (extra: object = {}) => ({
    id: 'd1', nome: 'Ana', numeroProcesso: 'P1', dataAdmissao: new Date(agora - 30 * H),
    cama_numero: '3', cama_quarto: '12', servico: 'Medicina',
    sv_data: new Date(agora - 2 * H), sv_news2: 0, sv_completo: true, sv_isolado3: false, sv_proxima: new Date(agora + 10 * H),
    braden_em: new Date(agora - 2 * H), braden_proxima: new Date(agora + 46 * H), braden_risco: 'baixo',
    morse_em: new Date(agora - 2 * H), morse_proxima: new Date(agora + 70 * H), morse_risco: 'baixo',
    dor_ate: null, dor_med: null,
    ...extra,
  });
  let prisma: any, svc: VigilanciaService;
  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    svc = new VigilanciaService(prisma);
  });

  it('nada em atraso quando tudo está em dia', async () => {
    prisma.$queryRaw.mockResolvedValue([linha()]);
    expect(await svc.doServico({ sub: 'u1', role: 'enfermeiro' })).toEqual([]);
  });

  it('sinais vitais em atraso, Braden inicial em falta e dor por reavaliar, ordenados pelo atraso', async () => {
    prisma.$queryRaw.mockResolvedValue([linha({
      sv_proxima: new Date(agora - 1 * H), sv_news2: 5,
      braden_em: null, braden_proxima: null,
      dor_ate: new Date(agora - 10 * 60_000), dor_med: 'Morfina',
    })]);
    const r = await svc.doServico({ sub: 'u1', role: 'enfermeiro' });
    expect(r.map((o) => o.tipo)).toEqual(['braden', 'sinais_vitais', 'dor_pos_analgesia']);
    expect(r[0]).toMatchObject({ motivo: 'Avaliação inicial em falta', cama: '12/3' });
    expect(r[0].atrasoMinutos).toBeGreaterThanOrEqual(6 * 60 - 1);
    expect(r[1].motivo).toBe('NEWS2 5');
    expect(r[2].motivo).toMatch(/Morfina/);
  });

  it('doente sem sinais vitais conta desde a admissão', async () => {
    prisma.$queryRaw.mockResolvedValue([linha({ sv_data: null, sv_proxima: null })]);
    const r = await svc.doServico({ sub: 'u1', role: 'enfermeiro' });
    expect(r[0]).toMatchObject({ tipo: 'sinais_vitais', motivo: 'Sem sinais vitais desde a admissão' });
  });

  it('por doente devolve também as próximas devidas (não só as em atraso)', async () => {
    prisma.$queryRaw.mockResolvedValue([linha()]);
    const r = await svc.doDoente('d1');
    expect(r.map((o) => o.tipo).sort()).toEqual(['braden', 'morse', 'sinais_vitais']);
    expect(r.every((o) => o.atrasoMinutos === 0)).toBe(true);
  });
});
