import { Test, TestingModule } from '@nestjs/testing';
import { EspecialidadesService } from './especialidades.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  sessaoEspecialidade: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const sessaoBase = {
  id: 'ses-1', doenteId: 'd1', profissionalId: 'prof-1', subRole: 'cardiologia',
  estado: 'agendada', data: new Date('2026-06-15'), duracao: 30,
};

describe('EspecialidadesService', () => {
  let service: EspecialidadesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EspecialidadesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EspecialidadesService>(EspecialidadesService);
  });

  describe('criar()', () => {
    it('cria sessão de especialidade', async () => {
      mockPrisma.sessaoEspecialidade.create.mockResolvedValue(sessaoBase);

      const resultado = await service.criar('prof-1', 'nutricao_clinica', {
        doenteId: 'd1', data: '2026-06-15', duracao: 30,
      });

      expect(resultado.id).toBe('ses-1');
    });

    it('lança ForbiddenException para sub-role inválido', async () => {
      await expect(
        service.criar('prof-1', 'cardiologia', { doenteId: 'd1', data: '2026-06-15', duracao: 30 }),
      ).rejects.toThrow();
    });
  });

  describe('porDoente()', () => {
    it('devolve sessões do doente', async () => {
      mockPrisma.sessaoEspecialidade.findMany.mockResolvedValue([sessaoBase]);

      const resultado = await service.porDoente('d1');

      expect(resultado).toHaveLength(1);
    });
  });

  describe('realizar()', () => {
    it('conclui sessão com evolução', async () => {
      mockPrisma.sessaoEspecialidade.findUnique.mockResolvedValue(sessaoBase);
      mockPrisma.sessaoEspecialidade.update.mockResolvedValue({ ...sessaoBase, estado: 'realizada' });

      const resultado = await service.realizar('ses-1', { evolucao: 'Sem alterações' });

      expect(resultado.estado).toBe('realizada');
    });
  });

  describe('cancelar()', () => {
    it('cancela sessão', async () => {
      mockPrisma.sessaoEspecialidade.findUnique.mockResolvedValue(sessaoBase);
      mockPrisma.sessaoEspecialidade.update.mockResolvedValue({ ...sessaoBase, estado: 'cancelada' });

      const resultado = await service.cancelar('ses-1');

      expect(resultado.estado).toBe('cancelada');
    });
  });
});
