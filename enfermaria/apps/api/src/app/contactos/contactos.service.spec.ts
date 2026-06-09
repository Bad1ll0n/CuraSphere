import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContactosService } from './contactos.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  contactoEmergencia: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), updateMany: jest.fn() },
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
    it('remove contacto', async () => {
      mockPrisma.contactoEmergencia.findUnique.mockResolvedValue(contactoBase);
      mockPrisma.contactoEmergencia.delete.mockResolvedValue(contactoBase);
      const r = await service.remover('ct-1');
      expect(r.id).toBe('ct-1');
    });

    it('lança NotFoundException quando contacto não existe', async () => {
      mockPrisma.contactoEmergencia.findUnique.mockResolvedValue(null);
      await expect(service.remover('x')).rejects.toThrow(NotFoundException);
    });
  });
});
