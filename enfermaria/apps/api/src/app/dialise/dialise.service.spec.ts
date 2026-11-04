import { DialiseService } from './dialise.service';

describe('DialiseService', () => {
  let service: DialiseService;
  let prisma: any;
  let alertas: any;

  beforeEach(() => {
    prisma = {
      sessaoDialise: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 's1', ...data, data: data.data ?? new Date() })),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    alertas = { criarAlerta: jest.fn().mockResolvedValue(undefined) };
    service = new DialiseService(prisma, alertas);
  });

  it('registarSessao calcula ganho interdialítico e UF objetivo', async () => {
    prisma.sessaoDialise.findFirst.mockResolvedValue({ pesoPosKg: 70 });
    const r = await service.registarSessao('d1', { modalidade: 'hemodialise', pesoPreKg: 72, pesoSecoKg: 70 }, 'u1');
    expect(r.ganhoInterdialitico).toBe(2); // 72 - 70
    expect(r.ufObjetivoMl).toBe(2000); // (72-70)*1000
  });

  it('registarSessao alerta em ganho excessivo (>2.5 kg)', async () => {
    prisma.sessaoDialise.findFirst.mockResolvedValue({ pesoPosKg: 70 });
    await service.registarSessao('d1', { modalidade: 'hemodialise', pesoPreKg: 73, pesoSecoKg: 70 }, 'u1');
    expect(alertas.criarAlerta).toHaveBeenCalledWith('d1', 'dialise', expect.stringContaining('excessivo'));
  });

  it('registarSessao não alerta em ganho normal', async () => {
    prisma.sessaoDialise.findFirst.mockResolvedValue({ pesoPosKg: 70 });
    await service.registarSessao('d1', { modalidade: 'hemodialise', pesoPreKg: 71, pesoSecoKg: 70 }, 'u1');
    expect(alertas.criarAlerta).not.toHaveBeenCalled();
  });

  it('registarSessao sem sessão anterior não calcula ganho', async () => {
    prisma.sessaoDialise.findFirst.mockResolvedValue(null);
    const r = await service.registarSessao('d1', { modalidade: 'hemodialise', pesoPreKg: 72 }, 'u1');
    expect(r.ganhoInterdialitico).toBeNull();
  });
});
