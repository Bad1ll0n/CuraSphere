import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContactosService } from './contactos.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  contactoEmergencia: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
};

const contactoBase = { id: 'ct-1', doenteId: 'd1', nome: 'Maria', relacao: 'mae', telefone: '912345678' };

describe('ContactosService', () => {
  let service: ContactosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', nome: 'Ana', ativo: true });
    mockPrisma.contactoEmergencia.findMany.mockResolvedValue([]);
    mockPrisma.contactoEmergencia.updateMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [ContactosService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<ContactosService>(ContactosService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('listar()', () => {
    it('devolve contactos do doente', async () => {
      mockPrisma.contactoEmergencia.findMany.mockResolvedValue([contactoBase]);
      const r = await service.listar('d1');
      expect(r).toHaveLength(1);
    });

    it('PERF-16: ordena pelo nome já decifrado (o principal primeiro), não pelo texto cifrado', async () => {
      mockPrisma.contactoEmergencia.findMany.mockResolvedValue([
        { ...contactoBase, id: 'c1', nome: 'Zélia', principal: false },
        { ...contactoBase, id: 'c2', nome: 'Óscar', principal: false },
        { ...contactoBase, id: 'c3', nome: 'Maria', principal: true },
        { ...contactoBase, id: 'c4', nome: 'Abel', principal: false },
      ]);
      const r = await service.listar('d1');
      expect(r.map((c: any) => c.nome)).toEqual(['Maria', 'Abel', 'Óscar', 'Zélia']);
      expect(mockPrisma.contactoEmergencia.findMany.mock.calls.at(-1)[0].orderBy).toEqual({ principal: 'desc' });
    });
  });

  describe('criar()', () => {
    it('cria contacto de emergência', async () => {
      mockPrisma.contactoEmergencia.create.mockResolvedValue(contactoBase);
      const r = await service.criar('d1', { nome: 'Maria', relacao: 'mae', telefone: '912345678' });
      expect(r.nome).toBe('Maria');
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);
      await expect(service.criar('x', { nome: 'Maria', relacao: 'mae', telefone: '912' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remover()', () => {
    it('ARQ-04: remove logicamente, guardando quem removeu (sem apagar a linha)', async () => {
      mockPrisma.contactoEmergencia.findUnique.mockResolvedValue(contactoBase);
      mockPrisma.contactoEmergencia.update.mockResolvedValue({ ...contactoBase, deletedAt: new Date() });
      const r = await service.remover('ct-1', 'u-1');
      expect(r.id).toBe('ct-1');
      expect(mockPrisma.contactoEmergencia.delete).not.toHaveBeenCalled();
      expect(mockPrisma.contactoEmergencia.update).toHaveBeenCalledWith({
        where: { id: 'ct-1' },
        data: { deletedAt: expect.any(Date), removidoPorId: 'u-1' },
      });
    });

    it('um contacto já removido é 404', async () => {
      mockPrisma.contactoEmergencia.findUnique.mockResolvedValue({ ...contactoBase, deletedAt: new Date() });
      await expect(service.remover('ct-1', 'u-1')).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando contacto não existe', async () => {
      mockPrisma.contactoEmergencia.findUnique.mockResolvedValue(null);
      await expect(service.remover('x')).rejects.toThrow(NotFoundException);
    });
  });
});
