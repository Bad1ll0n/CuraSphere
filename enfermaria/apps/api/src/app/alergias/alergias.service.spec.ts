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
  describe('PROD-06 — avaliação de alergias', () => {
    it('criar: medicamento fica codificado; não-medicamento é texto livre; reacção/certeza/fonte guardadas', async () => {
      mockPrisma.alergia.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'a', ...data }));
      const med = await service.criar('d1', 'medico', { alergenio: 'Amoxicilina', tipo: 'medicamento', severidade: 'grave', reacao: 'urticária', certeza: 'confirmada', fonte: 'doente' }, 'u1');
      expect(med).toMatchObject({ codigo: 'amoxicilina', sistemaCodigo: 'dci', reacao: 'urticária', certeza: 'confirmada', fonte: 'doente', verificadaPorId: 'u1' });
      const lat = await service.criar('d1', 'enfermeiro', { alergenio: 'Látex', tipo: 'latex', severidade: 'leve' });
      expect(lat).toMatchObject({ codigo: null, sistemaCodigo: 'livre', reacao: null, verificadaPorId: null });
    });

    it('criar: papel sem permissão → 403; doente inactivo → 404', async () => {
      await expect(service.criar('d1', 'farmaceutico', {})).rejects.toThrow(ForbiddenException);
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: false });
      await expect(service.criar('d1', 'medico', {})).rejects.toThrow(NotFoundException);
    });

    it('avaliacao: devolve o estado; doente inexistente → 404', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ avaliacaoAlergias: 'nao_avaliado', avaliacaoAlergiasEm: null, avaliacaoAlergiasPorId: null });
      expect(await service.avaliacao('d1')).toEqual({ estado: 'nao_avaliado', em: null, porId: null });
      mockPrisma.doente.findUnique.mockResolvedValue(null);
      await expect(service.avaliacao('x')).rejects.toThrow(NotFoundException);
    });

    it('sem alergias conhecidas: só sem alergias activas; regista quem e quando', async () => {
      await expect(service.registarSemAlergias('d1', 'u1', 'farmaceutico')).rejects.toThrow(ForbiddenException);
      mockPrisma.doente.findUnique.mockResolvedValueOnce(null);
      await expect(service.registarSemAlergias('x', 'u1', 'enfermeiro')).rejects.toThrow(NotFoundException);
      mockPrisma.alergia.count.mockResolvedValueOnce(2);
      await expect(service.registarSemAlergias('d1', 'u1', 'enfermeiro')).rejects.toThrow(/2 alergia/);
      mockPrisma.alergia.count.mockResolvedValueOnce(0);
      mockPrisma.doente.findUnique
        .mockResolvedValueOnce({ id: 'd1' })
        .mockResolvedValueOnce({ avaliacaoAlergias: 'sem_alergias_conhecidas', avaliacaoAlergiasEm: new Date(), avaliacaoAlergiasPorId: 'u1' });
      const r = await service.registarSemAlergias('d1', 'u1', 'enfermeiro');
      expect(r.estado).toBe('sem_alergias_conhecidas');
      expect(mockPrisma.doente.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ avaliacaoAlergias: 'sem_alergias_conhecidas', avaliacaoAlergiasPorId: 'u1' }),
      }));
    });

    it('remover a última alergia volta a "não avaliado"; se restarem outras, não mexe', async () => {
      mockPrisma.alergia.findUnique.mockResolvedValue({ id: 'al-1', doenteId: 'd1', deletedAt: null });
      mockPrisma.alergia.count.mockResolvedValueOnce(0);
      await service.remover('al-1', 'med-1', 'medico', 'registada por engano no doente errado');
      expect(mockPrisma.doente.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ avaliacaoAlergias: 'nao_avaliado' }) }));
      mockPrisma.doente.update.mockClear();
      mockPrisma.alergia.count.mockResolvedValueOnce(1);
      await service.remover('al-1', 'med-1', 'medico', 'registada por engano no doente errado');
      expect(mockPrisma.doente.update).not.toHaveBeenCalled();
    });
  });
});
