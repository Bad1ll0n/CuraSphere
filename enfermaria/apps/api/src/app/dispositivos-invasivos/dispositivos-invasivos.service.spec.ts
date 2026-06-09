import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DispositivosInvasivosService } from './dispositivos-invasivos.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  dispositivoInvasivo: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};

const dispositivoBase = { id: 'di-1', doenteId: 'd1', tipo: 'cvc', ativo: true };

describe('DispositivosInvasivosService', () => {
  let service: DispositivosInvasivosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', nome: 'Ana' });
    mockPrisma.dispositivoInvasivo.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [DispositivosInvasivosService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<DispositivosInvasivosService>(DispositivosInvasivosService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('listar()', () => {
    it('devolve dispositivos do doente', async () => {
      mockPrisma.dispositivoInvasivo.findMany.mockResolvedValue([dispositivoBase]);
      const r = await service.listar('d1');
      expect(r).toHaveLength(1);
    });
  });

  describe('registar()', () => {
    it('regista dispositivo invasivo', async () => {
      mockPrisma.dispositivoInvasivo.create.mockResolvedValue(dispositivoBase);
      const r = await service.registar('d1', 'enf-1', { tipo: 'cvc' });
      expect(r.tipo).toBe('cvc');
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);
      await expect(service.registar('x', 'enf-1', { tipo: 'cvc' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remover()', () => {
    it('marca dispositivo como inativo', async () => {
      mockPrisma.dispositivoInvasivo.findUnique.mockResolvedValue(dispositivoBase);
      mockPrisma.dispositivoInvasivo.update.mockResolvedValue({ ...dispositivoBase, ativo: false });
      const r = await service.remover('di-1');
      expect(r.ativo).toBe(false);
    });

    it('lança NotFoundException quando dispositivo não existe', async () => {
      mockPrisma.dispositivoInvasivo.findUnique.mockResolvedValue(null);
      await expect(service.remover('x')).rejects.toThrow(NotFoundException);
    });
  });
});
