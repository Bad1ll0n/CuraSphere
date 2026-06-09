jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"estadio":"II","sinaisInfecao":[],"tecidoLeito":"granulação","recomendacao":"Penso","confianca":"alta"}' }] }) },
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { FeridasService } from './feridas.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  avaliacaoFerida: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  fotoFerida: { create: jest.fn() },
};

const mockStorage = {
  upload: jest.fn().mockResolvedValue({ key: 'feridas/foto.jpg' }),
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url'),
};

const avaliacaoBase = {
  id: 'af-1', doenteId: 'd1', tipo: 'pressure_injury', localizacao: 'sacro',
  estadoCicatrizacao: 'cicatrizando', fotos: [],
  registadoPor: { id: 'enf-1', nome: 'Ana' },
};

describe('FeridasService', () => {
  let service: FeridasService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', nome: 'João', ativo: true });
    mockPrisma.avaliacaoFerida.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeridasService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();
    service = module.get<FeridasService>(FeridasService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('criar()', () => {
    it('cria avaliação de ferida', async () => {
      mockPrisma.avaliacaoFerida.create.mockResolvedValue(avaliacaoBase);
      const r = await service.criar('d1', { tipo: 'pressure_injury', localizacao: 'sacro', estadoCicatrizacao: 'cicatrizando' } as any, 'enf-1', 'enfermeiro');
      expect(r.tipo).toBe('pressure_injury');
    });

    it('lança ForbiddenException quando role não tem permissão', async () => {
      await expect(service.criar('d1', {} as any, 'u1', 'farmaceutico')).rejects.toThrow(ForbiddenException);
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);
      await expect(service.criar('x', {} as any, 'u1', 'enfermeiro')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listar()', () => {
    it('devolve avaliações do doente', async () => {
      mockPrisma.avaliacaoFerida.findMany.mockResolvedValue([avaliacaoBase]);
      const r = await service.listar('d1');
      expect(r).toHaveLength(1);
    });
  });
});
