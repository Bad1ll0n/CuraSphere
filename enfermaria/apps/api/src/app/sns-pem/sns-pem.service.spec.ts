import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SnsPemService } from './sns-pem.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  receitaEletronica: {
    create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'r1', ...data })),
    findMany: jest.fn().mockResolvedValue([]),
  },
};

describe('SnsPemService', () => {
  let service: SnsPemService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.receitaEletronica.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'r1', ...data }));
    const module: TestingModule = await Test.createTestingModule({
      providers: [SnsPemService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(SnsPemService);
  });

  it('emite e-receita (mock sandbox) e persiste com número PEM + ambiente sandbox', async () => {
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1' });
    const r: any = await service.emitir('d1', 'medico-1', { medicamentos: [{ nome: 'Amoxicilina', dose: '500 mg' }] } as any);
    expect(r.estado).toBe('emitida');
    expect(r.ambiente).toBe('sandbox');
    expect(r.numeroReceita).toBeTruthy();
    expect(mockPrisma.receitaEletronica.create).toHaveBeenCalledTimes(1);
  });

  it('lança NotFoundException quando o doente não existe', async () => {
    mockPrisma.doente.findUnique.mockResolvedValue(null);
    await expect(service.emitir('inexistente', 'm1', { medicamentos: [{ nome: 'X' }] } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listarPorDoente delega no prisma ordenado por data desc', async () => {
    await service.listarPorDoente('d1');
    expect(mockPrisma.receitaEletronica.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { doenteId: 'd1' }, orderBy: { criadaEm: 'desc' } }),
    );
  });
});
