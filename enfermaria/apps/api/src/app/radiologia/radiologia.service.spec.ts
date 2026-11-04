import { RadiologiaService } from './radiologia.service';

describe('RadiologiaService', () => {
  let service: RadiologiaService;
  let prisma: any;
  let alertas: any;

  beforeEach(() => {
    prisma = {
      exame: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      laudoRadiologico: {
        upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 'l1', ...create })),
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'l1', ...data })),
      },
    };
    alertas = { criarAlerta: jest.fn().mockResolvedValue(undefined) };
    service = new RadiologiaService(prisma, alertas);
  });

  it('guardarLaudo faz upsert num exame de imagem', async () => {
    prisma.exame.findUnique.mockResolvedValue({ id: 'e1', tipo: 'tc', laudo: null });
    const l = await service.guardarLaudo('e1', { achados: 'Sem alterações', conclusao: 'Normal' }, 'r1');
    expect(l.id).toBe('l1');
    expect(prisma.laudoRadiologico.upsert).toHaveBeenCalled();
  });

  it('guardarLaudo rejeita exame que não é de imagem', async () => {
    prisma.exame.findUnique.mockResolvedValue({ id: 'e1', tipo: 'analise_clinica', laudo: null });
    await expect(service.guardarLaudo('e1', { achados: 'x', conclusao: 'y' }, 'r1')).rejects.toThrow('exames de imagem');
  });

  it('guardarLaudo bloqueia laudo já assinado', async () => {
    prisma.exame.findUnique.mockResolvedValue({ id: 'e1', tipo: 'rx', laudo: { estado: 'assinado' } });
    await expect(service.guardarLaudo('e1', { achados: 'x', conclusao: 'y' }, 'r1')).rejects.toThrow('já assinado');
  });

  it('assinarLaudo alimenta o resultado do exame e alerta se urgente', async () => {
    prisma.laudoRadiologico.findUnique.mockResolvedValue({ id: 'l1', estado: 'rascunho', conclusao: 'Fratura', exame: { id: 'e1', doenteId: 'd1', urgente: true, tipo: 'rx' } });
    await service.assinarLaudo('l1', 'r1');
    expect(prisma.exame.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'e1' }, data: expect.objectContaining({ estado: 'resultado_disponivel', resultado: 'Fratura' }) }));
    expect(alertas.criarAlerta).toHaveBeenCalledWith('d1', 'imagiologia', expect.stringContaining('RX'));
  });

  it('assinarLaudo não alerta se o exame não é urgente', async () => {
    prisma.laudoRadiologico.findUnique.mockResolvedValue({ id: 'l1', estado: 'rascunho', conclusao: 'Normal', exame: { id: 'e1', doenteId: 'd1', urgente: false, tipo: 'tc' } });
    await service.assinarLaudo('l1', 'r1');
    expect(alertas.criarAlerta).not.toHaveBeenCalled();
  });

  it('assinarLaudo bloqueia laudo já assinado', async () => {
    prisma.laudoRadiologico.findUnique.mockResolvedValue({ id: 'l1', estado: 'assinado', exame: { id: 'e1' } });
    await expect(service.assinarLaudo('l1', 'r1')).rejects.toThrow('já assinado');
  });
});
