import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FamiliaService } from './familia.service';
import { hashTokenFamilia } from './token-familia';
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

const dto = { nomeContacto: 'Maria Mãe', email: 'mae@test.com' };

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

  describe('criarAcesso() — S-15', () => {
    beforeEach(() => {
      mockPrisma.acessoFamiliar.create.mockResolvedValue({
        id: 'ac-1', nomeContacto: 'Maria Mãe', email: 'mae@test.com',
        accessTokenExpiry: new Date(Date.now() + 7 * 24 * 3600000), ativo: true,
        doente: { nome: 'Ana' },
      });
    });

    it('devolve o token uma vez e guarda só o hash', async () => {
      const resultado = await service.criarAcesso('d1', dto, 'med-1');

      // 256 bits em base64url.
      expect(resultado.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const { data, select } = mockPrisma.acessoFamiliar.create.mock.calls[0][0];
      expect(data.accessTokenHash).toBe(hashTokenFamilia(resultado.accessToken));
      expect(data).not.toHaveProperty('accessToken');
      // Nem o hash sai na resposta.
      expect(select).not.toHaveProperty('accessTokenHash');
    });

    it('dois acessos nunca recebem o mesmo token', async () => {
      const a = await service.criarAcesso('d1', dto, 'med-1');
      const b = await service.criarAcesso('d1', dto, 'med-1');

      expect(a.accessToken).not.toBe(b.accessToken);
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(service.criarAcesso('x', dto, 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('portalDoente()', () => {
    const acessoValido = () => ({
      id: 'ac-1', nomeContacto: 'Maria Mãe', ativo: true,
      accessTokenExpiry: new Date(Date.now() + 3600000),
      doente: {
        nome: 'Ana', dataAdmissao: new Date(), sinaisVitais: [],
        cama: { numero: '12', quarto: '3', servico: 'cardiologia' },
      },
    });

    it('procura pelo hash do token, nunca pelo token', async () => {
      mockPrisma.acessoFamiliar.findUnique.mockResolvedValue(acessoValido());

      const resultado = await service.portalDoente('tok-abc');

      expect(mockPrisma.acessoFamiliar.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { accessTokenHash: hashTokenFamilia('tok-abc') } }),
      );
      expect(resultado.doente.nome).toBe('Ana');
    });

    it('mostra o serviço da cama do doente', async () => {
      mockPrisma.acessoFamiliar.findUnique.mockResolvedValue(acessoValido());

      const resultado = await service.portalDoente('tok-abc');

      expect(resultado.doente.servico).toBe('cardiologia');
    });

    it('recusa um token desmesurado sem ir à base de dados', async () => {
      await expect(service.portalDoente('x'.repeat(500))).rejects.toThrow(NotFoundException);
      expect(mockPrisma.acessoFamiliar.findUnique).not.toHaveBeenCalled();
    });

    it('recusa um acesso revogado', async () => {
      mockPrisma.acessoFamiliar.findUnique.mockResolvedValue({ ...acessoValido(), ativo: false });

      await expect(service.portalDoente('tok-abc')).rejects.toThrow(ForbiddenException);
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
    it('revoga o acesso do doente indicado', async () => {
      mockPrisma.acessoFamiliar.findUnique.mockResolvedValue({ id: 'ac-1', doenteId: 'd1' });
      mockPrisma.acessoFamiliar.update.mockResolvedValue({ id: 'ac-1', ativo: false });

      await service.revogarAcesso('d1', 'ac-1');

      expect(mockPrisma.acessoFamiliar.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { ativo: false } }),
      );
    });

    it('não revoga o acesso da família de outro doente', async () => {
      // O interceptor confirmou o acesso a d1; o id pedido pertence a d2.
      mockPrisma.acessoFamiliar.findUnique.mockResolvedValue({ id: 'ac-9', doenteId: 'd2' });

      await expect(service.revogarAcesso('d1', 'ac-9')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.acessoFamiliar.update).not.toHaveBeenCalled();
    });
  });
});
