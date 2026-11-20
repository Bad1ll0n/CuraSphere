import { limiteContinuidade, temAtribuicaoEmVigor, PAPEIS_SEM_ACESSO_CLINICO } from './acesso-por-atribuicao';

describe('acesso por atribuição (SEC-14)', () => {
  const agora = new Date('2026-11-20T12:00:00Z');
  const prisma = (direta: unknown, emTurno: unknown) => ({
    atribuicaoDoente: { findFirst: jest.fn().mockResolvedValue(direta) },
    atribuicaoHorarioTurno: { findFirst: jest.fn().mockResolvedValue(emTurno) },
  });

  it('o prazo de continuidade é de 7 dias por omissão', () => {
    expect(limiteContinuidade(agora).toISOString()).toBe('2026-11-13T12:00:00.000Z');
  });

  it('só conta atribuições dentro do prazo (não "qualquer turno de sempre")', async () => {
    const p = prisma(null, null);
    expect(await temAtribuicaoEmVigor(p, 'u1', 'd1', agora)).toBe(false);
    expect(p.atribuicaoDoente.findFirst.mock.calls[0][0].where).toEqual({
      doenteId: 'd1', enfermeiroId: 'u1', turno: { dataFim: { gte: new Date('2026-11-13T12:00:00Z') } },
    });
    expect(p.atribuicaoHorarioTurno.findFirst.mock.calls[0][0].where).toEqual({
      doenteId: 'd1', utilizadorId: 'u1', horarioTurno: { data: { gte: new Date('2026-11-12T12:00:00Z') } },
    });
  });

  it('uma atribuição em vigor (direta ou em turno) dá acesso', async () => {
    expect(await temAtribuicaoEmVigor(prisma({ id: 'a' }, null), 'u1', 'd1', agora)).toBe(true);
    expect(await temAtribuicaoEmVigor(prisma(null, { id: 'b' }), 'u1', 'd1', agora)).toBe(true);
  });

  it('TI e administrativo nunca têm acesso clínico', () => {
    expect(PAPEIS_SEM_ACESSO_CLINICO).toEqual(['ti', 'administrativo']);
  });
});
