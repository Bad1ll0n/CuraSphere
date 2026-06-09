jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: '["sepsis","antibiótico"]' }] }) },
  })),
}));

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    embeddings: { create: jest.fn().mockResolvedValue({ data: [{ embedding: Array(1536).fill(0.1) }] }) },
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { GuidelinesService } from './guidelines.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  guidelineClinica: {
    findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(),
  },
  $queryRaw: jest.fn().mockResolvedValue([]),
};

const guidelineBase = {
  id: 'g-1', titulo: 'Guideline Sépsis', categoria: 'sepsis', conteudo: 'Conteúdo clínico', fonte: 'NICE',
  embeddingJson: null, termosIndexados: null,
};

describe('GuidelinesService', () => {
  let service: GuidelinesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.guidelineClinica.findMany.mockResolvedValue([]);
    mockPrisma.guidelineClinica.findUnique.mockResolvedValue(guidelineBase);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [GuidelinesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<GuidelinesService>(GuidelinesService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('buscar()', () => {
    it('devolve guidelines por query FTS (fallback $queryRaw)', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([guidelineBase]);
      const r = await service.buscar('sepsis');
      expect(r).toHaveLength(1);
    });

    it('devolve array vazio quando query vazia', async () => {
      const r = await service.buscar('');
      expect(r).toEqual([]);
    });
  });

  describe('indexarGuideline()', () => {
    it('indexa guideline existente sem lançar erro', async () => {
      mockPrisma.guidelineClinica.update.mockResolvedValue(guidelineBase);
      await expect(service.indexarGuideline('g-1')).resolves.not.toThrow();
    });

    it('termina silenciosamente quando guideline não existe', async () => {
      mockPrisma.guidelineClinica.findUnique.mockResolvedValue(null);
      await expect(service.indexarGuideline('x')).resolves.not.toThrow();
    });
  });
});
