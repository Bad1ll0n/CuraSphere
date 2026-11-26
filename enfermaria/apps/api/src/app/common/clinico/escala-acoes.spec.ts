import { acoesDaEscala, aplicarAcoesEscala } from './escala-acoes';

describe('escala → ação (PROD-21)', () => {
  it('limiares das escalas validadas', () => {
    expect(acoesDaEscala('NRS2002', 3)[0].regra).toBe('Nutrição (NRS-2002)');
    expect(acoesDaEscala('NRS2002', 2)).toEqual([]);
    expect(acoesDaEscala('Barthel', 60)[0].descricao).toMatch(/moderada/);
    expect(acoesDaEscala('Barthel', 15)[0].descricao).toMatch(/total/);
    expect(acoesDaEscala('Barthel', 61)).toEqual([]);
    expect(acoesDaEscala('FOIS', 4)).toHaveLength(1);
    expect(acoesDaEscala('FOIS', 5)).toEqual([]);
    expect(acoesDaEscala('morse', 55, 'alto')).toHaveLength(1);
    expect(acoesDaEscala('morse', 30, 'moderado')).toEqual([]);
    expect(acoesDaEscala('RASS', 0)).toEqual([]);
  });

  it('a descrição começa pela etiqueta da regra (é o que evita repetir a tarefa)', () => {
    for (const [t, p, r] of [['NRS2002', 4], ['Barthel', 30], ['FOIS', 2], ['morse', 60, 'alto'], ['braden', 10, 'alto']] as const) {
      const [a] = acoesDaEscala(t, p, r as string | undefined);
      expect(a.descricao.startsWith(a.regra)).toBe(true);
    }
  });

  it('cria a tarefa com prazo e grupo; não repete uma ainda aberta da mesma regra', async () => {
    const prisma = {
      tarefa: {
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 't1' }),
        create: jest.fn(async ({ data }) => ({ id: 'nova', descricao: data.descricao })),
      },
    };
    const agora = new Date('2026-11-26T10:00:00Z');
    const acoes = acoesDaEscala('NRS2002', 5);
    expect(await aplicarAcoesEscala(prisma, 'd1', 'enf', acoes, agora)).toHaveLength(1);
    expect(prisma.tarefa.create.mock.calls[0][0].data).toMatchObject({
      doenteId: 'd1', criadoPorId: 'enf', tipo: 'clinica', prioridade: 'alta', grupoResponsavel: 'enfermeiro',
      prazo: new Date('2026-11-27T10:00:00Z'),
    });
    expect(await aplicarAcoesEscala(prisma, 'd1', 'enf', acoes, agora)).toEqual([]); // já há uma aberta
    expect(prisma.tarefa.findFirst.mock.calls[1][0].where).toMatchObject({ estado: { in: ['pendente', 'em_progresso'] }, descricao: { startsWith: 'Nutrição (NRS-2002)' } });
  });
});
