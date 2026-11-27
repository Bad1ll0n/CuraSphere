import { LeiturasMonitorService } from './leituras-monitor.service';

/** PROD-15 — validação em lote das leituras de monitor: o enfermeiro passa a ser o autor. */
describe('LeiturasMonitorService', () => {
  const agora = Date.now();
  const leitura = (id: string, minutosAtras: number, valores: Record<string, unknown> = { pulso: 80 }) => ({
    id, doenteId: 'd1', dispositivoId: 'disp-1', canal: 'monitor', estado: 'pendente', valores,
    medidoEm: new Date(agora - minutosAtras * 60_000),
  });

  let prisma: any;
  let sinais: any;
  let service: LeiturasMonitorService;

  beforeEach(() => {
    prisma = {
      leituraMonitor: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
      },
      doente: { findFirst: jest.fn() },
    };
    sinais = { ingerirDeMonitor: jest.fn().mockImplementation(async () => ({ id: `sv-${Math.random()}` })) };
    service = new LeiturasMonitorService(prisma, sinais, { criarAlerta: jest.fn() } as any);
  });

  it('valida as pendentes do doente, da mais recente para a mais antiga, com o enfermeiro como autor', async () => {
    prisma.leituraMonitor.findMany.mockResolvedValue([leitura('a', 5), leitura('b', 30)]);
    const r = await service.validar('d1', ['a', 'b'], 'enf-1');

    expect(r).toEqual({ validadas: 2, falhas: [] });
    expect(prisma.leituraMonitor.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['a', 'b'] }, doenteId: 'd1', estado: 'pendente' }, orderBy: { medidoEm: 'desc' },
    }));
    expect(sinais.ingerirDeMonitor).toHaveBeenNthCalledWith(1, 'd1', 'enf-1', expect.objectContaining({ pulso: 80, medidoEm: expect.any(String) }), 'disp-1');
    expect(prisma.leituraMonitor.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'a', estado: 'pendente' }, data: expect.objectContaining({ estado: 'validada', validadaPorId: 'enf-1' }),
    }));
  });

  it('uma leitura já reclamada por outro enfermeiro não é duplicada', async () => {
    prisma.leituraMonitor.findMany.mockResolvedValue([leitura('a', 5)]);
    prisma.leituraMonitor.updateMany.mockResolvedValue({ count: 0 });
    const r = await service.validar('d1', ['a'], 'enf-1');
    expect(r.validadas).toBe(0);
    expect(sinais.ingerirDeMonitor).not.toHaveBeenCalled();
  });

  it('se o registo clínico falhar, a leitura volta a pendente e a falha é devolvida', async () => {
    prisma.leituraMonitor.findMany.mockResolvedValue([leitura('a', 5)]);
    sinais.ingerirDeMonitor.mockRejectedValue(new Error('Doente não encontrado'));
    const r = await service.validar('d1', ['a'], 'enf-1');
    expect(r).toEqual({ validadas: 0, falhas: [{ id: 'a', motivo: 'Doente não encontrado' }] });
    expect(prisma.leituraMonitor.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { estado: 'pendente', validadaPorId: null, validadaEm: null } });
  });

  it('rejeitar como artefacto guarda quem e porquê, só nas pendentes do doente', async () => {
    prisma.leituraMonitor.updateMany.mockResolvedValue({ count: 2 });
    const r = await service.rejeitar('d1', ['a', 'b'], 'enf-1', '  Sensor de SpO2 solto  ');
    expect(r).toEqual({ rejeitadas: 2 });
    expect(prisma.leituraMonitor.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] }, doenteId: 'd1', estado: 'pendente' },
      data: expect.objectContaining({ estado: 'rejeitada', validadaPorId: 'enf-1', motivoRejeicao: 'Sensor de SpO2 solto' }),
    });
  });

  it('receber ignora parâmetros desconhecidos e recusa leitura vazia', async () => {
    prisma.leituraMonitor.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'lm', ...data }));
    const l = await service.receber({ dispositivoId: 'disp-1', canal: 'monitor', doenteId: 'd1', valores: { pulso: 70, hack: 1, avpu: 'A' } });
    expect(l.valores).toEqual({ pulso: 70, avpu: 'A' });
    expect(l.critica).toBe(false);
    await expect(service.receber({ dispositivoId: 'disp-1', canal: 'monitor', doenteId: 'd1', valores: { hack: 1 } })).rejects.toThrow(/sem parâmetros/);
  });

  it('pendentes: só dentro da janela de registo diferido', async () => {
    prisma.leituraMonitor.findMany.mockResolvedValue([]);
    await service.pendentes('d1');
    const { where } = prisma.leituraMonitor.findMany.mock.calls[0][0];
    expect(where).toEqual(expect.objectContaining({ doenteId: 'd1', estado: 'pendente' }));
    expect(Date.now() - where.medidoEm.gte.getTime()).toBeGreaterThan(11 * 3_600_000);
  });
});
