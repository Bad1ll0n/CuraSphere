import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ListaEsperaService } from './lista-espera.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  listaEspera: {
    create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'e1', ...data })),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'e1', ...data })),
  },
};
const entry = (over: any) => ({ id: over.id, prioridade: over.prioridade, criadaEm: over.criadaEm, estado: 'em_espera' });

describe('ListaEsperaService', () => {
  let service: ListaEsperaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.listaEspera.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'e1', ...data }));
    mockPrisma.listaEspera.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'e1', ...data }));
    const module: TestingModule = await Test.createTestingModule({
      providers: [ListaEsperaService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(ListaEsperaService);
  });

  it('adicionar usa prioridade normal por omissão', async () => {
    await service.adicionar({ especialidade: 'Cardiologia' } as any);
    expect(mockPrisma.listaEspera.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ prioridade: 'normal' }) }),
    );
  });

  it('listar ordena por prioridade (urgente→alta→normal) e depois por antiguidade', async () => {
    mockPrisma.listaEspera.findMany.mockResolvedValue([
      entry({ id: 'normal-novo', prioridade: 'normal', criadaEm: new Date('2026-02-01') }),
      entry({ id: 'urgente', prioridade: 'urgente', criadaEm: new Date('2026-03-01') }),
      entry({ id: 'normal-velho', prioridade: 'normal', criadaEm: new Date('2026-01-01') }),
      entry({ id: 'alta', prioridade: 'alta', criadaEm: new Date('2026-03-05') }),
    ]);
    const r = await service.listar('Cardiologia');
    expect(r.map((x) => x.id)).toEqual(['urgente', 'alta', 'normal-velho', 'normal-novo']);
  });

  it('atualizarEstado lança NotFoundException quando não existe', async () => {
    mockPrisma.listaEspera.findUnique.mockResolvedValue(null);
    await expect(service.atualizarEstado('x', 'agendado')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('proximoParaVaga marca o primeiro da fila como contactado', async () => {
    mockPrisma.listaEspera.findMany.mockResolvedValue([
      entry({ id: 'urgente', prioridade: 'urgente', criadaEm: new Date('2026-03-01') }),
      entry({ id: 'normal', prioridade: 'normal', criadaEm: new Date('2026-01-01') }),
    ]);
    const r = await service.proximoParaVaga('Cardiologia');
    expect(r?.id).toBe('urgente');
    expect(mockPrisma.listaEspera.update).toHaveBeenCalledWith({ where: { id: 'urgente' }, data: { estado: 'contactado' } });
  });

  it('proximoParaVaga devolve null com a fila vazia', async () => {
    mockPrisma.listaEspera.findMany.mockResolvedValue([]);
    expect(await service.proximoParaVaga('Cardiologia')).toBeNull();
  });
});
