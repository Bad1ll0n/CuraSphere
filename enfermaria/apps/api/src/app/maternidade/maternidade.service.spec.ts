import { MaternidadeService } from './maternidade.service';

describe('MaternidadeService', () => {
  let service: MaternidadeService;
  let prisma: any;
  let alertas: any;

  beforeEach(() => {
    prisma = {
      gravidez: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'g1', ...data })),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'g1', doenteId: 'd1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      registoPartograma: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'r1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      parto: {
        upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 'p1', ...create })),
      },
    };
    alertas = { criarAlerta: jest.fn().mockResolvedValue(undefined) };
    service = new MaternidadeService(prisma, alertas);
  });

  it('criarGravidez calcula DPP a partir da DUM quando não é fornecida', async () => {
    const g = await service.criarGravidez('d1', { dataUltimaMenstruacao: '2024-01-01' }, 'u1');
    expect(g.dataPrevistaParto?.toISOString().slice(0, 10)).toBe('2024-10-07'); // DUM + 280d
  });

  it('criarGravidez respeita a DPP fornecida', async () => {
    const g = await service.criarGravidez('d1', { dataPrevistaParto: '2024-12-25' }, 'u1');
    expect(g.dataPrevistaParto?.toISOString().slice(0, 10)).toBe('2024-12-25');
  });

  it('adicionarPartograma gera alerta com FC fetal em bradicardia', async () => {
    await service.adicionarPartograma('g1', { fcFetal: 100 }, 'u1');
    expect(alertas.criarAlerta).toHaveBeenCalledWith('d1', 'partograma', expect.stringContaining('bradicardia'));
  });

  it('adicionarPartograma NÃO gera alerta com FC fetal normal', async () => {
    await service.adicionarPartograma('g1', { fcFetal: 140 }, 'u1');
    expect(alertas.criarAlerta).not.toHaveBeenCalled();
  });

  it('registarParto conclui a gravidez', async () => {
    await service.registarParto('g1', { tipo: 'eutocico' }, 'u1');
    expect(prisma.gravidez.update).toHaveBeenCalledWith({ where: { id: 'g1' }, data: { estado: 'concluida' } });
  });

  it('doenteIdDaGravidez falha se a gravidez não existe', async () => {
    prisma.gravidez.findUnique.mockResolvedValueOnce(null);
    await expect(service.doenteIdDaGravidez('x')).rejects.toThrow('Gravidez não encontrada.');
  });
});
