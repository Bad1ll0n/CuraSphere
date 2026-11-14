import { BadRequestException, ConflictException } from '@nestjs/common';
import { PassagemIsbarService, turnoAnterior, turnoDe } from './passagem-isbar.service';

// UX-22 — passagem de turno ISBAR: turno do hospital, entrega e confirmação de receção.
describe('PassagemIsbarService', () => {
  it('turno do hospital (Lisboa): manhã 08–16, tarde 16–24, noite 00–08', () => {
    expect(turnoDe(new Date('2026-07-10T08:30:00Z'))).toEqual({ data: '2026-07-10', turno: 'manha' }); // 09:30 verão
    expect(turnoDe(new Date('2026-07-10T15:30:00Z'))).toEqual({ data: '2026-07-10', turno: 'tarde' }); // 16:30
    expect(turnoDe(new Date('2026-12-10T23:30:00Z'))).toEqual({ data: '2026-12-10', turno: 'tarde' }); // 23:30 inverno
    expect(turnoDe(new Date('2026-12-11T03:00:00Z'))).toEqual({ data: '2026-12-11', turno: 'noite' });
  });

  it('turno anterior: tarde ← manhã; noite ← tarde do dia anterior; manhã ← noite', () => {
    expect(turnoAnterior('2026-11-07', 'tarde')).toEqual({ data: '2026-11-07', turno: 'manha' });
    expect(turnoAnterior('2026-11-07', 'noite')).toEqual({ data: '2026-11-06', turno: 'tarde' });
    expect(turnoAnterior('2026-11-07', 'manha')).toEqual({ data: '2026-11-07', turno: 'noite' });
  });

  let prisma: any, svc: PassagemIsbarService;
  const conteudo = { identificacao: 'I', situacao: 'S', antecedentes: 'B', avaliacao: 'A', recomendacoes: 'R' };
  beforeEach(() => {
    prisma = {
      doente: { findUnique: jest.fn().mockResolvedValue({ id: 'd1', ativo: true, cama: { servico: 'Medicina' } }) },
      episodioInternamento: { findFirst: jest.fn().mockResolvedValue({ id: 'ep-1' }) },
      passagemIsbar: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(({ create }: any) => Promise.resolve({ id: 'p1', ...create })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    svc = new PassagemIsbarService(prisma, { tenantId: 'default' } as any, { doDoente: jest.fn().mockResolvedValue([]) } as any);
  });

  it('entregar exige as cinco secções; guarda servico e episódio', async () => {
    await expect(svc.guardar('d1', 'enf-1', { ...conteudo, avaliacao: '  ', entregar: true })).rejects.toThrow(BadRequestException);
    const p = await svc.guardar('d1', 'enf-1', { ...conteudo, entregar: true });
    expect(p).toMatchObject({ estado: 'entregue', servico: 'Medicina', episodioId: 'ep-1', autorId: 'enf-1', entregueEm: expect.any(Date) });
  });

  it('rascunho fica rascunho; uma passagem recebida já não muda', async () => {
    expect(await svc.guardar('d1', 'enf-1', conteudo)).toMatchObject({ estado: 'rascunho' });
    prisma.passagemIsbar.findUnique.mockResolvedValue({ id: 'p1', estado: 'recebida' });
    await expect(svc.guardar('d1', 'enf-1', conteudo)).rejects.toThrow(ConflictException);
  });

  it('receber: não pelo autor; só depois de entregue; uma vez', async () => {
    prisma.passagemIsbar.findUnique.mockResolvedValue({ id: 'p1', autorId: 'enf-1', estado: 'entregue' });
    await expect(svc.receber('p1', 'enf-1')).rejects.toThrow(/não pode confirmar/);
    prisma.passagemIsbar.findUnique.mockResolvedValue({ id: 'p1', autorId: 'enf-1', estado: 'rascunho' });
    await expect(svc.receber('p1', 'enf-2')).rejects.toThrow(/ainda não foi entregue/);
    prisma.passagemIsbar.findUnique.mockResolvedValue({ id: 'p1', autorId: 'enf-1', estado: 'entregue' });
    await svc.receber('p1', 'enf-2');
    expect(prisma.passagemIsbar.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', estado: 'entregue' },
      data: { estado: 'recebida', recebidaPorId: 'enf-2', recebidaEm: expect.any(Date) },
    });
  });
});
