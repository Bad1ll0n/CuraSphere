// pdfmake usa ESM — evitar import real do módulo
jest.mock('../common/pdf.service', () => ({
  PdfService: jest.fn().mockImplementation(() => ({
    gerarSumarioAlta: jest.fn().mockResolvedValue(Buffer.from('pdf')),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PortalDoenteService } from './portal-doente.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage.service';
import { PdfService } from '../common/pdf.service';

// Evitar hashing real nos testes
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hash-simulado'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcryptjs';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  portalDoente: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  documentoSaude: { findMany: jest.fn() },
  medicacao: { findMany: jest.fn() },
  planoAlta: { findFirst: jest.fn() },
  sinalVital: { findMany: jest.fn() },
};

const mockJwt = { sign: jest.fn().mockReturnValue('jwt-token-simulado') };
const mockStorage = { getSignedUrl: jest.fn().mockResolvedValue('https://signed.url/doc') };
const mockPdf = { gerarSumarioAlta: jest.fn().mockResolvedValue(Buffer.from('pdf')) };

describe('PortalDoenteService', () => {
  let service: PortalDoenteService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash-simulado');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    mockJwt.sign.mockReturnValue('jwt-token-simulado');
    mockStorage.getSignedUrl.mockResolvedValue('https://signed.url/doc');
    mockPdf.gerarSumarioAlta.mockResolvedValue(Buffer.from('pdf'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalDoenteService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: StorageService, useValue: mockStorage },
        { provide: PdfService, useValue: mockPdf },
      ],
    }).compile();

    service = module.get<PortalDoenteService>(PortalDoenteService);
  });

  // ── criarAcesso() ────────────────────────────────────────────────────────────

  describe('criarAcesso()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(service.criarAcesso('d1', 'test@test.com', 'senha', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando doente está inativo', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: false });

      await expect(service.criarAcesso('d1', 'test@test.com', 'senha', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('lança ConflictException quando email já existe para outro doente', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: true });
      mockPrisma.portalDoente.findUnique.mockResolvedValue({ id: 'p-outro', doenteId: 'd-outro', email: 'test@test.com' });

      await expect(service.criarAcesso('d1', 'test@test.com', 'senha', 'admin-1')).rejects.toThrow(ConflictException);
    });

    it('cria acesso e faz hash da senha', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: true });
      mockPrisma.portalDoente.findUnique.mockResolvedValue(null);
      mockPrisma.portalDoente.upsert.mockResolvedValue({ id: 'p1', doenteId: 'd1', email: 'test@test.com', ativo: true, criadoEm: new Date() });

      const resultado = await service.criarAcesso('d1', 'test@test.com', 'senha123', 'admin-1');

      expect(bcrypt.hash).toHaveBeenCalledWith('senha123', 12);
      expect(mockPrisma.portalDoente.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ passwordHash: 'hash-simulado' }) }),
      );
      expect(resultado.email).toBe('test@test.com');
    });
  });

  // ── login() ──────────────────────────────────────────────────────────────────

  describe('login()', () => {
    const portalAtivo = {
      id: 'p1', ativo: true, passwordHash: 'hash-simulado',
      doenteId: 'd1', email: 'test@test.com',
      doente: { id: 'd1', nome: 'Ana', ativo: true },
    };

    it('lança UnauthorizedException quando portal não existe', async () => {
      mockPrisma.portalDoente.findUnique.mockResolvedValue(null);
      await expect(service.login('test@test.com', 'senha')).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException quando portal está inativo', async () => {
      mockPrisma.portalDoente.findUnique.mockResolvedValue({ ...portalAtivo, ativo: false });
      await expect(service.login('test@test.com', 'senha')).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException quando senha é inválida', async () => {
      mockPrisma.portalDoente.findUnique.mockResolvedValue(portalAtivo);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('test@test.com', 'senha-errada')).rejects.toThrow(UnauthorizedException);
    });

    it('devolve accessToken e dados do doente em login válido', async () => {
      mockPrisma.portalDoente.findUnique.mockResolvedValue(portalAtivo);

      const resultado = await service.login('test@test.com', 'senha-certa');

      expect(resultado.accessToken).toBe('jwt-token-simulado');
      expect(resultado.doente.nome).toBe('Ana');
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'portal', doenteId: 'd1' }),
        expect.any(Object),
      );
    });
  });

  // ── me() ─────────────────────────────────────────────────────────────────────

  describe('me()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);
      await expect(service.me('d-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('devolve dados do doente', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', nome: 'Ana', estado: 'internado' });
      const resultado = await service.me('d1');
      expect(resultado.nome).toBe('Ana');
    });
  });

  // ── exportarDados() ──────────────────────────────────────────────────────────

  describe('exportarDados()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);
      await expect(service.exportarDados('d-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('devolve buffer PDF', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', nome: 'Ana' });
      const resultado = await service.exportarDados('d1');
      expect(Buffer.isBuffer(resultado)).toBe(true);
    });
  });
});
