import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AlergiasService } from './alergias.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma: any = {
  doente: { findUnique: jest.fn(), update: jest.fn() },
  alergia: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), update: jest.fn(), count: jest.fn() },
};
// $transaction: aceita a forma em array e a forma com função.
mockPrisma.$transaction = jest.fn((x: any) => (Array.isArray(x) ? Promise.all(x) : x(mockPrisma)));

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
      // PROD-06: o alergénio fica codificado e o doente passa a "com alergias".
      expect(mockPrisma.alergia.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ sistemaCodigo: expect.any(String) }),
      }));
      expect(mockPrisma.doente.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'd1' }, data: expect.objectContaining({ avaliacaoAlergias: 'com_alergias' }),
      }));
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);
      await expect(service.criar('x', 'enfermeiro', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remover()', () => {
    const MOTIVO = 'Teste de provocação negativo';

    it('marca a alergia como removida, com quem e porquê — nunca a apaga (QA-02)', async () => {
      mockPrisma.alergia.findUnique.mockResolvedValue({ id: 'al-1', doenteId: 'd1', deletedAt: null });
      mockPrisma.alergia.update.mockResolvedValue({ id: 'al-1' });
      mockPrisma.alergia.count.mockResolvedValue(0);

      await service.remover('al-1', 'med-1', 'medico', `  ${MOTIVO}  `);

      expect(mockPrisma.alergia.delete).not.toHaveBeenCalled();
      expect(mockPrisma.alergia.update).toHaveBeenCalledWith({
        where: { id: 'al-1' },
        data: { deletedAt: expect.any(Date), removidaPorId: 'med-1', motivoRemocao: MOTIVO },
      });
    });

    it('só um médico remove uma alergia', async () => {
      mockPrisma.alergia.findUnique.mockResolvedValue({ id: 'al-1', deletedAt: null });

      await expect(service.remover('al-1', 'enf-1', 'enfermeiro', MOTIVO)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.alergia.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando a alergia não existe ou já foi removida', async () => {
      mockPrisma.alergia.findUnique.mockResolvedValue(null);
      await expect(service.remover('x', 'med-1', 'medico', MOTIVO)).rejects.toThrow(NotFoundException);

      mockPrisma.alergia.findUnique.mockResolvedValue({ id: 'al-1', deletedAt: new Date() });
      await expect(service.remover('al-1', 'med-1', 'medico', MOTIVO)).rejects.toThrow(NotFoundException);
    });

    it('a lista não inclui alergias removidas', async () => {
      mockPrisma.alergia.findMany.mockResolvedValue([]);
      await service.listar('d1');
      expect(mockPrisma.alergia.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { doenteId: 'd1', deletedAt: null } }),
      );
    });
  });
});
