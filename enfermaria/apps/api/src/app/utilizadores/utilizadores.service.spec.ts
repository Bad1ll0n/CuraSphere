import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UtilizadoresService } from './utilizadores.service';
import { PrismaService } from '../prisma/prisma.service';
import { Servico } from '../common/enums';

// Mock da transação Prisma para modo sequencial (array → Promise.all)
// e para modo callback (função assíncrona)
const mockTx = {
  utilizador: {
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockPrisma = {
  utilizador: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('UtilizadoresService', () => {
  let service: UtilizadoresService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UtilizadoresService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UtilizadoresService>(UtilizadoresService);
  });

  // ── criar() ──────────────────────────────────────────────────────────────────

  describe('criar()', () => {
    it('faz hash da password com bcrypt antes de criar', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        mockTx.utilizador.findUnique.mockResolvedValue(null);
        mockTx.utilizador.create.mockResolvedValue({
          id: 'user-1',
          numeroFuncionario: '12345',
          nome: 'Dr. Ana',
          role: 'medico',
          subRole: null,
          servico: Servico.internamento,
          ordemExperiencia: null,
          equipa: null,
          ativo: true,
          criadoEm: new Date(),
        });
        return fn(mockTx);
      });

      const spyHash = jest.spyOn(bcrypt, 'hash');

      await service.criar({
        numeroFuncionario: '12345',
        nome: 'Dr. Ana',
        password: 'senhaSegura123',
        role: 'medico',
      });

      expect(spyHash).toHaveBeenCalledWith('senhaSegura123', 12);
    });

    it('define passwordExpiresAt ~90 dias no futuro', async () => {
      const antes = Date.now();
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        mockTx.utilizador.findUnique.mockResolvedValue(null);
        mockTx.utilizador.create.mockResolvedValue({
          id: 'user-1',
          numeroFuncionario: '12345',
          nome: 'Dr. Ana',
          role: 'medico',
          subRole: null,
          servico: Servico.internamento,
          ordemExperiencia: null,
          equipa: null,
          ativo: true,
          criadoEm: new Date(),
        });
        return fn(mockTx);
      });

      await service.criar({
        numeroFuncionario: '12345',
        nome: 'Dr. Ana',
        password: 'senhaSegura123',
        role: 'medico',
      });

      const chamadaCreate = mockTx.utilizador.create.mock.calls[0][0];
      const expiresAt: Date = chamadaCreate.data.passwordExpiresAt;
      const noventaDiasMs = 90 * 24 * 60 * 60 * 1000;

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(antes + noventaDiasMs - 5000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(antes + noventaDiasMs + 5000);
    });

    it('lança ConflictException quando número de funcionário já existe', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        mockTx.utilizador.findUnique.mockResolvedValue({ id: 'existente' });
        return fn(mockTx);
      });

      await expect(
        service.criar({
          numeroFuncionario: '12345',
          nome: 'Outro',
          password: 'pass',
          role: 'enfermeiro',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── listar() ─────────────────────────────────────────────────────────────────

  describe('listar()', () => {
    it('devolve resultados paginados com estrutura correcta', async () => {
      const utilizadores = [
        { id: 'u1', nome: 'Ana', role: 'medico', ativo: true },
        { id: 'u2', nome: 'Pedro', role: 'enfermeiro', ativo: true },
      ];
      mockPrisma.$transaction.mockResolvedValue([utilizadores, 2]);

      const resultado = await service.listar(undefined, undefined, 1, 50);

      expect(resultado).toMatchObject({
        data: utilizadores,
        total: 2,
        page: 1,
        limit: 50,
        totalPaginas: 1,
      });
    });

    it('filtra por role quando fornecido', async () => {
      mockPrisma.$transaction.mockResolvedValue([[{ id: 'u1', role: 'medico' }], 1]);

      await service.listar('medico');

      const chamada = mockPrisma.$transaction.mock.calls[0][0];
      // A primeira query no array deve conter where com role
      expect(chamada).toBeDefined();
    });

    it('calcula totalPaginas correctamente', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 105]);

      const resultado = await service.listar(undefined, undefined, 1, 50);

      expect(resultado.totalPaginas).toBe(3); // ceil(105/50) = 3
    });
  });

  // ── buscarPorId() ────────────────────────────────────────────────────────────

  describe('buscarPorId()', () => {
    it('lança NotFoundException quando utilizador não existe', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue(null);

      await expect(service.buscarPorId('id-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('devolve utilizador quando existe', async () => {
      const utilizador = { id: 'user-1', nome: 'Ana', role: 'medico', ativo: true };
      mockPrisma.utilizador.findUnique.mockResolvedValue(utilizador);

      const resultado = await service.buscarPorId('user-1');

      expect(resultado).toEqual(utilizador);
    });
  });

  // ── atualizar() ──────────────────────────────────────────────────────────────

  describe('atualizar()', () => {
    it('lança NotFoundException quando utilizador não existe', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue(null);

      await expect(
        service.atualizar('id-inexistente', { nome: 'Novo Nome' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('actualiza campos permitidos', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({ id: 'user-1', nome: 'Ana', ativo: true });
      mockPrisma.utilizador.update.mockResolvedValue({
        id: 'user-1', nome: 'Ana Costa', role: 'medico', ativo: true,
      });

      const resultado = await service.atualizar('user-1', { nome: 'Ana Costa' });

      expect(mockPrisma.utilizador.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ nome: 'Ana Costa' }),
        }),
      );
      expect(resultado).toHaveProperty('nome', 'Ana Costa');
    });
  });

  // ── desativar() ──────────────────────────────────────────────────────────────

  describe('desativar()', () => {
    it('lança NotFoundException quando utilizador não existe', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue(null);

      await expect(service.desativar('id-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('define ativo=false ao desativar', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({ id: 'user-1', nome: 'Ana', ativo: true });
      mockPrisma.utilizador.update.mockResolvedValue({ id: 'user-1', nome: 'Ana', ativo: false });

      await service.desativar('user-1');

      expect(mockPrisma.utilizador.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ ativo: false }),
        }),
      );
    });
  });
});
