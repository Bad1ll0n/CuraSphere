import { OncologiaService } from './oncologia.service';

describe('OncologiaService', () => {
  let service: OncologiaService;
  let prisma: any;
  let alertas: any;

  beforeEach(() => {
    prisma = {
      planoQuimioterapia: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'p1', ...data })),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      cicloQuimioterapia: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'c1', ...data })),
        count: jest.fn().mockResolvedValue(2),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'c1', ...data })),
      },
    };
    alertas = { criarAlerta: jest.fn().mockResolvedValue(undefined) };
    service = new OncologiaService(prisma, alertas);
  });

  it('criarPlano calcula a BSA e normaliza os fármacos', async () => {
    const plano = await service.criarPlano('d1', {
      protocoloNome: 'FOLFOX', ciclosPrevistos: 6, pesoKg: 70, alturaCm: 170,
      farmacos: [{ nome: 'Oxaliplatina', mgPorM2: 85 }, { nome: 'lixo', mgPorM2: 0 } as any],
    }, 'u1');
    expect(plano.superficieCorporalM2).toBeCloseTo(1.82, 2);
    expect((plano.farmacos as any[]).length).toBe(1); // fármaco inválido descartado
  });

  it('criarPlano falha sem fármacos válidos', async () => {
    await expect(service.criarPlano('d1', { protocoloNome: 'X', ciclosPrevistos: 1, farmacos: [] }, 'u1'))
      .rejects.toThrow('pelo menos um fármaco');
  });

  it('agendarCiclo numera automaticamente (count+1)', async () => {
    prisma.planoQuimioterapia.findUnique.mockResolvedValue({ id: 'p1', doenteId: 'd1', intervaloDias: 21, superficieCorporalM2: 1.8, farmacos: [] });
    const ciclo = await service.agendarCiclo('p1', {});
    expect(ciclo.numero).toBe(3); // count=2 → 3
  });

  it('administrarCiclo alerta em toxicidade CTCAE ≥3', async () => {
    prisma.cicloQuimioterapia.findUnique.mockResolvedValue({ id: 'c1', numero: 1, planoId: 'p1', plano: { id: 'p1', doenteId: 'd1', intervaloDias: 21 } });
    prisma.cicloQuimioterapia.findFirst.mockResolvedValue(null);
    await service.administrarCiclo('c1', { toxicidadeGrau: 3 }, 'u1');
    expect(alertas.criarAlerta).toHaveBeenCalledWith('d1', 'quimioterapia', expect.stringContaining('grau 3'));
  });

  it('administrarCiclo avisa se o intervalo foi curto', async () => {
    prisma.cicloQuimioterapia.findUnique.mockResolvedValue({ id: 'c1', numero: 2, planoId: 'p1', plano: { id: 'p1', doenteId: 'd1', intervaloDias: 21 } });
    prisma.cicloQuimioterapia.findFirst.mockResolvedValue({ dataAdministracao: new Date(Date.now() - 5 * 86_400_000) });
    const r = await service.administrarCiclo('c1', {}, 'u1');
    expect(r.aviso).toMatch(/5d após o anterior/);
    expect(alertas.criarAlerta).not.toHaveBeenCalled();
  });
});
