import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfiguracoesService } from './configuracoes.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  roleConfig: { findMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
  subRoleConfig: { findMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
};

const roleBase = { id: 'r-1', chave: 'enfermeiro', label: 'Enfermeiro', categoria: 'clinico', ativo: true, ordem: 1 };
const subRoleBase = { id: 'sr-1', chave: 'nutricao_clinica', label: 'Nutrição Clínica', roleChave: 'enfermeiro', ativo: true, ordem: 1 };

describe('ConfiguracoesService', () => {
  let service: ConfiguracoesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.roleConfig.findMany.mockResolvedValue([]);
    mockPrisma.subRoleConfig.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfiguracoesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<ConfiguracoesService>(ConfiguracoesService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('listarRoles()', () => {
    it('devolve roles activos', async () => {
      mockPrisma.roleConfig.findMany.mockResolvedValue([roleBase]);
      const r = await service.listarRoles();
      expect(r).toHaveLength(1);
    });
  });

  describe('criarRole()', () => {
    it('cria role', async () => {
      mockPrisma.roleConfig.findUnique.mockResolvedValue(null);
      mockPrisma.roleConfig.create.mockResolvedValue(roleBase);
      const r = await service.criarRole({ chave: 'enfermeiro', label: 'Enfermeiro', categoria: 'clinico' });
      expect(r.chave).toBe('enfermeiro');
    });

    it('lança ConflictException quando role já existe', async () => {
      mockPrisma.roleConfig.findUnique.mockResolvedValue(roleBase);
      await expect(service.criarRole({ chave: 'enfermeiro', label: 'Enfermeiro', categoria: 'clinico' })).rejects.toThrow(ConflictException);
    });
  });

  describe('editarRole()', () => {
    it('edita role', async () => {
      mockPrisma.roleConfig.findUniqueOrThrow.mockResolvedValue(roleBase);
      mockPrisma.roleConfig.update.mockResolvedValue({ ...roleBase, label: 'Atualizado' });
      const r = await service.editarRole('r-1', { label: 'Atualizado' });
      expect(r.label).toBe('Atualizado');
    });
  });

  describe('criarSubRole()', () => {
    it('cria sub-role', async () => {
      mockPrisma.roleConfig.findUnique.mockResolvedValue(roleBase);
      mockPrisma.subRoleConfig.findUnique.mockResolvedValue(null);
      mockPrisma.subRoleConfig.create.mockResolvedValue(subRoleBase);
      const r = await service.criarSubRole({ chave: 'nutricao_clinica', label: 'Nutrição', roleChave: 'enfermeiro' });
      expect(r.chave).toBe('nutricao_clinica');
    });

    it('lança NotFoundException quando role pai não existe', async () => {
      mockPrisma.roleConfig.findUnique.mockResolvedValue(null);
      await expect(service.criarSubRole({ chave: 'x', label: 'X', roleChave: 'inexistente' })).rejects.toThrow(NotFoundException);
    });
  });
});
