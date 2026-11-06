// pdfmake 0.3: API de topo (`setFonts` + `createPdf().getBuffer()`). O mock evita gerar PDFs reais.
jest.mock('pdfmake', () => ({
  setFonts: jest.fn(),
  setUrlAccessPolicy: jest.fn(),
  setLocalAccessPolicy: jest.fn(),
  createPdf: jest.fn(() => ({ getBuffer: jest.fn().mockResolvedValue(Buffer.from('pdf')) })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  sumarioAlta: { findFirst: jest.fn() },
  notaClinica: { findMany: jest.fn().mockResolvedValue([]) },
  turno: { findUnique: jest.fn() },
  passagemTurno: { findMany: jest.fn().mockResolvedValue([]) },
  medicacao: { findMany: jest.fn().mockResolvedValue([]) },
};

const doenteBase = {
  id: 'd1', nome: 'João Silva', dataNascimento: '1980-01-01', numProcesso: '12345',
  cama: { numero: '10A' }, alergias: [], medicacoes: [], sinaisVitais: [],
  atribuicoes: [],
};

describe('PdfService', () => {
  let service: PdfService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.doente.findUnique.mockResolvedValue(doenteBase);
    mockPrisma.sumarioAlta.findFirst.mockResolvedValue(null);
    mockPrisma.notaClinica.findMany.mockResolvedValue([]);
    mockPrisma.medicacao.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<PdfService>(PdfService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('gerarSumarioAlta()', () => {
    it('gera PDF como Buffer', async () => {
      const buf = await service.gerarSumarioAlta('d1');
      expect(buf).toBeInstanceOf(Buffer);
    });

    it('lança erro quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);
      await expect(service.gerarSumarioAlta('x')).rejects.toThrow('Doente não encontrado');
    });
  });
});
