import { ListagemDoentesService, turnoActual } from './listagem-doentes.service';

jest.mock('../prisma/encryption.middleware', () => ({
  filtroPesquisaNome: (t: string) => ({ nomeBusca: { contains: `tok(${t})` } }),
}));

describe('ListagemDoentesService (PERF-05)', () => {
  const doente = (id: string) => ({
    id, nome: `Doente ${id}`, numeroProcesso: `P${id}`, diagnosticoPrincipal: 'Pneumonia', alergias: 'penicilina',
    estadoRegisto: 'internado', ativo: true, cama: { id: 'c' + id, numero: '1', quarto: '2', servico: 'Medicina', notas: 'x' },
  });
  let prisma: any;
  let service: ListagemDoentesService;

  beforeEach(() => {
    prisma = { doente: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    service = new ListagemDoentesService(prisma, { tenantId: 't1' } as any);
  });

  const whereDe = (i = 0) => prisma.doente.findMany.mock.calls[i][0].where;

  it('supervisão pesquisa por nome (índice cego), processo e diagnóstico, sem filtro de atribuição', async () => {
    await service.listar('u1', 'todos', { search: '  zulmira ' });
    const w = whereDe();
    expect(w).not.toHaveProperty('atribuicoesHorario');
    expect(w.tenantId).toBe('t1');
    expect(w.OR).toEqual([
      { nomeBusca: { contains: 'tok(zulmira)' } },
      { numeroProcesso: { contains: 'zulmira', mode: 'insensitive' } },
      { diagnosticoPrincipal: { contains: 'zulmira', mode: 'insensitive' } },
    ]);
  });

  it('administrativo: pesquisa só por identificação e recebe a visão administrativa', async () => {
    prisma.doente.findMany.mockResolvedValue([doente('1')]);
    prisma.doente.count.mockResolvedValue(1);
    const r = await service.listar('u1', 'administrativo', { search: 'pneumonia' });
    expect(whereDe().OR).toHaveLength(2);
    expect(JSON.stringify(whereDe())).not.toContain('diagnosticoPrincipal');
    expect(r.data[0]).not.toHaveProperty('diagnosticoPrincipal');
    expect(r.data[0]).not.toHaveProperty('alergias');
    expect(r.data[0].nome).toBe('Doente 1');
  });

  it('TI também só recebe a identificação', async () => {
    prisma.doente.findMany.mockResolvedValue([doente('1')]);
    const r = await service.listar('u1', 'ti');
    expect(r.data[0]).not.toHaveProperty('diagnosticoPrincipal');
  });

  it('clínico sem pesquisa: só os doentes atribuídos no turno', async () => {
    prisma.doente.findMany.mockResolvedValue([doente('1')]);
    const r = await service.listar('u1', 'enfermeiro');
    expect(whereDe().atribuicoesHorario.some.utilizadorId).toBe('u1');
    expect(whereDe().estadoRegisto).toBe('internado');
    expect(r.data[0]).toMatchObject({ atribuido: true, diagnosticoPrincipal: 'Pneumonia' });
  });

  it('clínico com pesquisa: diagnóstico só nos seus; os outros só por identificação e sem dados clínicos', async () => {
    prisma.doente.findMany
      .mockResolvedValueOnce([doente('1'), doente('2')]) // página
      .mockResolvedValueOnce([{ id: '1' }]); // quais estão atribuídos
    prisma.doente.count.mockResolvedValue(2);
    const r = await service.listar('u1', 'medico', { search: 'maria' });

    const [meus, outros] = whereDe().OR;
    expect(meus.AND[0].atribuicoesHorario.some.utilizadorId).toBe('u1');
    expect(JSON.stringify(meus.AND[1])).toContain('diagnosticoPrincipal');
    expect(JSON.stringify(outros)).not.toContain('diagnosticoPrincipal');

    expect(r.data[0]).toMatchObject({ id: '1', atribuido: true, diagnosticoPrincipal: 'Pneumonia' });
    expect(r.data[1]).toMatchObject({ id: '2', atribuido: false, nome: 'Doente 2' });
    expect(r.data[1]).not.toHaveProperty('diagnosticoPrincipal');
    expect(r.data[1].cama).toEqual({ id: 'c2', numero: '1', quarto: '2', servico: 'Medicina' });
  });

  it('limita a página a 100 e o termo a 100 caracteres', async () => {
    await service.listar('u1', 'todos', { limit: 500, page: 0, search: 'a'.repeat(300) });
    const args = prisma.doente.findMany.mock.calls[0][0];
    expect(args.take).toBe(100);
    expect(args.skip).toBe(0);
    expect(args.where.OR[1].numeroProcesso.contains).toHaveLength(100);
  });

  it('turno: 10:00 é manhã; 02:00 é a noite do dia clínico anterior', () => {
    expect(turnoActual(new Date(2026, 10, 20, 10, 0)).tipo).toBe('manha');
    expect(turnoActual(new Date(2026, 10, 20, 17, 0)).tipo).toBe('tarde');
    const noite = turnoActual(new Date(2026, 10, 20, 2, 0));
    expect(noite.tipo).toBe('noite');
    expect(noite.data.gte.getTime()).toBeLessThan(turnoActual(new Date(2026, 10, 20, 10, 0)).data.gte.getTime());
  });
});
