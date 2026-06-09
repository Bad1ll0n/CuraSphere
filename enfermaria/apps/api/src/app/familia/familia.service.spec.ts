import { Test, TestingModule } from '@nestjs/testing';
import { FamiliaService } from './familia.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  acessoFamiliar: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

describe('FamiliaService', () => {
  let service: FamiliaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', nome: 'Ana' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamiliaService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FamiliaService>(FamiliaService);
  });

  describe('criarAcesso()', () => {
    it('cria acesso familiar com token', async () => {
      const expiry = new Date(Date.now() + 7 * 24 * 3600000);
      mockPrisma.acessoFamiliar.create.mockResolvedValue({
        id: 'ac-1', nomeContacto: 'Maria Mãe', email: 'mae@test.com',
        accessToken: 'tok-abc', accessTokenExpiry: expiry, ativo: true,
        doente: { nome: 'Ana' },
      });

      const resultado = await service.criarAcesso(
        'd1',
        { nomeContacto: 'Maria Mãe', email: 'mae@test.com' },
        'med-1',
      );

      expect(resultado).toHaveProperty('accessToken');
      expect(mockPrisma.acessoFamiliar.create).toHaveBeenCalledTimes(1);
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(
        service.criarAcesso('x', { nomeContacto: 'Maria', email: 'm@test.com' }, 'u1'),
      ).rejects.toThrow();
    });
  });

  describe('portalDoente()', () => {
    it('devolve dados do portal para token válido', async () => {
      const expiry = new Date(Date.now() + 3600000);
      mockPrisma.acessoFamiliar.findUnique.mockResolvedValue({
        id: 'ac-1', nomeContacto: 'Maria Mãe', ativo: true, accessTokenExpiry: expiry,
        doente: {
          id: 'd1', nome: 'Ana', dataAdmissao: new Date(), servico: 'cardiologia',
          sinaisVitais: [], alertasClinicos: [], cama: null,
        },
      });

      const resultado = await service.portalDoente('tok-abc');

      expect(resultado).toBeDefined();
      expect(resultado.doente.nome).toBe('Ana');
    });
  });

  describe('listarAcessos()', () => {
    it('devolve acessos do doente', async () => {
      mockPrisma.acessoFamiliar.findMany.mockResolvedValue([{ id: 'ac-1' }]);

      const resultado = await service.listarAcessos('d1');

      expect(resultado).toHaveLength(1);
    });
  });

  describe('revogarAcesso()', () => {
    it('revoga acesso familiar', async () => {
      mockPrisma.acessoFamiliar.findUnique.mockResolvedValue({ id: 'ac-1', ativo: true });
      mockPrisma.acessoFamiliar.update.mockResolvedValue({ id: 'ac-1', ativo: false });

      await service.revogarAcesso('ac-1');

      expect(mockPrisma.acessoFamiliar.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ ativo: false }) }),
      );
    });
  });
});
