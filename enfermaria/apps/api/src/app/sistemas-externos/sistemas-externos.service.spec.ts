import { Test, TestingModule } from '@nestjs/testing';
import { SistemasExternosService } from './sistemas-externos.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  sistemaExternoSaude: { findMany: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
};

const sistemaBase = { id: 'se-1', nome: 'FHIR Server', tipo: 'fhir_r4', ativo: true };

describe('SistemasExternosService', () => {
  let service: SistemasExternosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.sistemaExternoSaude.findMany.mockResolvedValue([]);
    mockPrisma.sistemaExternoSaude.findUniqueOrThrow.mockResolvedValue(sistemaBase);

    const module: TestingModule = await Test.createTestingModule({
      providers: [SistemasExternosService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<SistemasExternosService>(SistemasExternosService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('listar()', () => {
    it('devolve sistemas externos', async () => {
      mockPrisma.sistemaExternoSaude.findMany.mockResolvedValue([sistemaBase]);
      const r = await service.listar();
      expect(r).toHaveLength(1);
    });
  });

  describe('criar()', () => {
    it('cria sistema externo', async () => {
      mockPrisma.sistemaExternoSaude.create.mockResolvedValue(sistemaBase);
      const r = await service.criar({ nome: 'FHIR Server', tipo: 'fhir_r4' });
      expect(r.nome).toBe('FHIR Server');
    });
  });

  describe('obter()', () => {
    it('devolve sistema pelo ID', async () => {
      const r = await service.obter('se-1');
      expect(r.nome).toBe('FHIR Server');
    });
  });
});
