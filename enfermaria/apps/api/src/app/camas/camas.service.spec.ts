import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CamasService } from './camas.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { EstadoCama } from '../common/enums';

const mockPrisma = {
  cama: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('CamasService', () => {
  let service: CamasService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(undefined);
    mockRedis.del.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CamasService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: TenantContextService, useValue: { tenantId: 'default', run: (_id: string, fn: () => unknown) => fn() } },
      ],
    }).compile();

    service = module.get<CamasService>(CamasService);
  });

  // ── criar() ──────────────────────────────────────────────────────────────────

  describe('criar()', () => {
    it('lança ConflictException quando cama com mesmo número já existe', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', numero: '101' });

      await expect(service.criar({ numero: '101', quarto: 'A' })).rejects.toThrow(ConflictException);
    });

    it('cria cama com sucesso, chama redis.del e retorna a cama criada', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue(null);
      const novaCama = { id: 'cama-1', numero: '102', quarto: 'B' };
      mockPrisma.cama.create.mockResolvedValue(novaCama);

      const resultado = await service.criar({ numero: '102', quarto: 'B' });

      expect(resultado).toEqual(novaCama);
      expect(mockRedis.del).toHaveBeenCalledWith('camas:lista', 'camas:ocupacao');
    });
  });

  // ── atualizarEstado() ─────────────────────────────────────────────────────────

  describe('atualizarEstado()', () => {
    it('lança NotFoundException quando cama não existe', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue(null);

      await expect(service.atualizarEstado('id-x', EstadoCama.ocupada)).rejects.toThrow(NotFoundException);
    });

    it('atualiza estado com sucesso, chama prisma.cama.update com { data: { estado } } e redis.del', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', numero: '101', estado: 'livre' });
      const camaAtualizada = { id: 'cama-1', estado: EstadoCama.ocupada, doente: null };
      mockPrisma.cama.update.mockResolvedValue(camaAtualizada);

      const resultado = await service.atualizarEstado('cama-1', EstadoCama.ocupada);

      expect(mockPrisma.cama.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { estado: EstadoCama.ocupada } }),
      );
      expect(mockRedis.del).toHaveBeenCalledWith('camas:lista', 'camas:ocupacao');
      expect(resultado).toEqual(camaAtualizada);
    });
  });

  // ── confirmarLimpeza() ────────────────────────────────────────────────────────

  describe('confirmarLimpeza()', () => {
    it('lança NotFoundException quando cama não existe', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue(null);

      await expect(service.confirmarLimpeza('id-x')).rejects.toThrow(NotFoundException);
    });

    it('lança ConflictException quando cama não está em estado em_limpeza', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'ocupada' });

      await expect(service.confirmarLimpeza('cama-1')).rejects.toThrow(ConflictException);
    });

    it('atualiza para livre com sucesso quando cama está em em_limpeza', async () => {
      mockPrisma.cama.findUnique.mockResolvedValue({ id: 'cama-1', estado: 'em_limpeza' });
      const camaLimpa = { id: 'cama-1', estado: 'livre', doente: null };
      mockPrisma.cama.update.mockResolvedValue(camaLimpa);

      const resultado = await service.confirmarLimpeza('cama-1');

      expect(mockPrisma.cama.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { estado: 'livre' } }),
      );
      expect(mockRedis.del).toHaveBeenCalledWith('camas:lista', 'camas:ocupacao');
      expect(resultado).toEqual(camaLimpa);
    });
  });

  // ── ocupacao() ────────────────────────────────────────────────────────────────

  describe('ocupacao()', () => {
    it('retorna dados do cache se redis.get retornar valor sem chamar prisma.cama.count', async () => {
      const cachedData = { total: 10, ocupadas: 5, livres: 3, emLimpeza: 1, reservadas: 1 };
      mockRedis.get.mockResolvedValue(cachedData);

      const resultado = await service.ocupacao();

      expect(resultado).toEqual(cachedData);
      expect(mockPrisma.cama.count).not.toHaveBeenCalled();
    });

    it('calcula ocupação com 5 chamadas prisma.cama.count e guarda em cache com redis.set', async () => {
      mockPrisma.cama.count
        .mockResolvedValueOnce(10)  // total
        .mockResolvedValueOnce(5)   // ocupadas
        .mockResolvedValueOnce(3)   // livres
        .mockResolvedValueOnce(1)   // emLimpeza
        .mockResolvedValueOnce(1);  // reservadas

      const resultado = await service.ocupacao();

      expect(mockPrisma.cama.count).toHaveBeenCalledTimes(5);
      expect(resultado).toEqual({ total: 10, ocupadas: 5, livres: 3, emLimpeza: 1, reservadas: 1 });
      expect(mockRedis.set).toHaveBeenCalledWith(
        'camas:ocupacao',
        { total: 10, ocupadas: 5, livres: 3, emLimpeza: 1, reservadas: 1 },
        30,
      );
    });
  });
});
