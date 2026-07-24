import { Test, TestingModule } from '@nestjs/testing';
import { AcessoLeituraService } from './acesso-leitura.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = { acessoLeitura: { createMany: jest.fn().mockResolvedValue({ count: 0 }) } };

describe('AcessoLeituraService', () => {
  let service: AcessoLeituraService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.acessoLeitura.createMany.mockResolvedValue({ count: 0 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [AcessoLeituraService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(AcessoLeituraService);
  });
  afterEach(() => service.onModuleDestroy());

  it('registar enfileira sem escrever de imediato', () => {
    service.registar({ entidadeTipo: 'doentes', entidadeId: 'd1', utilizadorId: 'u1' });
    expect(mockPrisma.acessoLeitura.createMany).not.toHaveBeenCalled();
  });

  it('flush escreve a fila em lote (createMany)', async () => {
    service.registar({ entidadeTipo: 'doentes', entidadeId: 'd1', utilizadorId: 'u1', utilizadorRole: 'medico' });
    service.registar({ entidadeTipo: 'doentes', entidadeId: 'd2', utilizadorId: 'u2' });
    await (service as any).flush();
    expect(mockPrisma.acessoLeitura.createMany).toHaveBeenCalledTimes(1);
    const data = mockPrisma.acessoLeitura.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ entidadeTipo: 'doentes', entidadeId: 'd1', utilizadorRole: 'medico' });
  });

  it('em falha, repõe o lote na fila (não perde silenciosamente)', async () => {
    mockPrisma.acessoLeitura.createMany.mockRejectedValueOnce(new Error('BD offline'));
    service.registar({ entidadeTipo: 'doentes', entidadeId: 'd1' });
    await (service as any).flush();
    mockPrisma.acessoLeitura.createMany.mockResolvedValue({ count: 1 });
    await (service as any).flush();
    expect(mockPrisma.acessoLeitura.createMany).toHaveBeenCalledTimes(2);
  });
});
