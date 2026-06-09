import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AlergiasService } from './alergias.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  alergia: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
};

describe('AlergiasService', () => {
  let service: AlergiasService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', nome: 'Ana', ativo: true });
    mockPrisma.alergia.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [AlergiasService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<AlergiasService>(AlergiasService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('listar()', () => {
    it('devolve alergias do doente', async () => {
      mockPrisma.alergia.findMany.mockResolvedValue([{ id: 'al-1', alergenio: 'Penicilina' }]);
      const r = await service.listar('d1');
      expect(r).toHaveLength(1);
    });
  });

  describe('criar()', () => {
    it('cria alergia', async () => {
      mockPrisma.alergia.create.mockResolvedValue({ id: 'al-1', alergenio: 'Penicilina' });
      const r = await service.criar('d1', 'enfermeiro', { alergenio: 'Penicilina', tipo: 'medicamento', severidade: 'grave' });
      expect(r.alergenio).toBe('Penicilina');
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);
      await expect(service.criar('x', 'enfermeiro', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remover()', () => {
    it('remove alergia', async () => {
      mockPrisma.alergia.findUnique.mockResolvedValue({ id: 'al-1' });
      mockPrisma.alergia.delete.mockResolvedValue({ id: 'al-1' });
      const r = await service.remover('al-1', 'enfermeiro');
      expect(r.id).toBe('al-1');
    });

    it('lança NotFoundException quando alergia não existe', async () => {
      mockPrisma.alergia.findUnique.mockResolvedValue(null);
      await expect(service.remover('x', 'enfermeiro')).rejects.toThrow(NotFoundException);
    });
  });
});
