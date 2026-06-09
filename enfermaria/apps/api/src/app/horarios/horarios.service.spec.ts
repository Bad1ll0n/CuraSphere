import { Test, TestingModule } from '@nestjs/testing';
import { HorariosService } from './horarios.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  escala: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  horarioTurno: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  atribuicaoHorarioTurno: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
};

const escalaBase = { id: 'esc-1', mes: 6, ano: 2026, turnos: [] };

describe('HorariosService', () => {
  let service: HorariosService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.escala.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [HorariosService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<HorariosService>(HorariosService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('listar()', () => {
    it('devolve escalas paginadas', async () => {
      mockPrisma.escala.findMany.mockResolvedValue([escalaBase]);
      const r = await service.listar();
      expect(r).toHaveLength(1);
    });
  });
});
