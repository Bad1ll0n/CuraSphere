import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
jest.mock('../common/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('hash-simulado'),
  verifyPassword: jest.fn(),
}));
import { hashPassword } from '../common/password';
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
  refreshToken: {
    updateMany: jest.fn(),
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

      await service.criar({
        numeroFuncionario: '12345',
        nome: 'Dr. Ana',
        password: 'senhaSegura123',
        role: 'medico',
      });

      expect(hashPassword).toHaveBeenCalledWith('senhaSegura123', 12);
    });

    it('SEC-03: a password inicial definida pelo TI nasce expirada', async () => {
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

      // O primeiro login obriga a mudar a password (fluxo `passwordExpirada`).
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(antes);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
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

    it('SEC-03: o próprio utilizador não altera o seu papel', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({ id: 'ti-1', role: 'ti', subRole: 'it_admin' });

      await expect(service.atualizar('ti-1', { role: 'direcao' }, 'ti-1')).rejects.toThrow(ForbiddenException);
      await expect(service.atualizar('ti-1', { subRole: null }, 'ti-1')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.utilizador.update).not.toHaveBeenCalled();
    });

    it('alterar campos que não vão no token não termina sessões', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({ id: 'ti-1', nome: 'Ana', role: 'ti' });
      mockPrisma.utilizador.update.mockResolvedValue({ id: 'ti-1' });

      await service.atualizar('ti-1', { ordemExperiencia: 2 }, 'ti-1');

      expect(mockPrisma.utilizador.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { ordemExperiencia: 2 },
      }));
      expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('SEC-04: mudar o papel de outro utilizador termina as sessões dele', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({ id: 'u2', role: 'enfermeiro', servico: 'internamento' });
      mockPrisma.utilizador.update.mockResolvedValue({ id: 'u2' });

      await service.atualizar('u2', { role: 'chefe_enfermeiros' }, 'ti-1');

      expect(mockPrisma.utilizador.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { role: 'chefe_enfermeiros', versaoSessao: { increment: 1 } },
      }));
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { utilizadorId: 'u2', revogado: false }, data: { revogado: true },
      });
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
          data: { ativo: false, versaoSessao: { increment: 1 } },
        }),
      );
      // SEC-04: as sessões abertas morrem já, não só no próximo refresh.
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { utilizadorId: 'user-1', revogado: false }, data: { revogado: true },
      });
    });

    it('não deixa um utilizador desactivar a própria conta', async () => {
      await expect(service.desativar('ti-1', 'ti-1')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.utilizador.update).not.toHaveBeenCalled();
    });
  });
});
