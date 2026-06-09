import { Test, TestingModule } from '@nestjs/testing';
import { AtosClinicosService } from './atos-clinicos.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  atoClinico: { findMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
};

const atoBase = { id: 'ato-1', codigo: 'COD01', descricao: 'Consulta', categoria: 'consulta', precoBase: 50, ativo: true };

describe('AtosClinicosService', () => {
  let service: AtosClinicosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.atoClinico.findMany.mockResolvedValue([]);
    mockPrisma.atoClinico.findUniqueOrThrow.mockResolvedValue(atoBase);

    const module: TestingModule = await Test.createTestingModule({
      providers: [AtosClinicosService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<AtosClinicosService>(AtosClinicosService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('listar()', () => {
    it('devolve atos clínicos ativos', async () => {
      mockPrisma.atoClinico.findMany.mockResolvedValue([atoBase]);
      const r = await service.listar();
      expect(r).toHaveLength(1);
    });
  });

  describe('criar()', () => {
    it('cria ato clínico', async () => {
      mockPrisma.atoClinico.findUnique.mockResolvedValue(null);
      mockPrisma.atoClinico.create.mockResolvedValue(atoBase);
      const r = await service.criar({ codigo: 'COD01', descricao: 'Consulta', categoria: 'consulta', precoBase: 50 });
      expect(r.codigo).toBe('COD01');
    });
  });

  describe('desativar()', () => {
    it('desativa ato clínico', async () => {
      mockPrisma.atoClinico.update.mockResolvedValue({ ...atoBase, ativo: false });
      const r = await service.desativar('ato-1');
      expect(r.ativo).toBe(false);
    });
  });
});
