import { Test, TestingModule } from '@nestjs/testing';
import { SinaisVitaisController } from './sinais-vitais.controller';
import { SinaisVitaisService } from './sinais-vitais.service';
import { DoenteService } from '../doentes/doentes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

const mockSinaisVitaisService = {
  criar: jest.fn(),
  listar: jest.fn(),
  ultimo: jest.fn(),
  calcularScores: jest.fn(),
  analisarTendencia: jest.fn(),
};

const mockDoenteService = {
  assertAcessoDoente: jest.fn().mockResolvedValue(undefined),
};

const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('SinaisVitaisController', () => {
  let controller: SinaisVitaisController;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockGuard.canActivate.mockReturnValue(true);
    mockDoenteService.assertAcessoDoente.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SinaisVitaisController],
      providers: [
        { provide: SinaisVitaisService, useValue: mockSinaisVitaisService },
        { provide: DoenteService, useValue: mockDoenteService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(mockGuard)
      .overrideGuard(RolesGuard).useValue(mockGuard)
      .compile();

    controller = module.get<SinaisVitaisController>(SinaisVitaisController);
  });

  // ── POST /sinais-vitais/:doenteId ─────────────────────────────────────────────

  describe('criar()', () => {
    it('chama service.criar com doenteId, userId, role e dto', () => {
      const dto = { pressaoSistolica: 120, pressaoDiastolica: 80, pulso: 72, saturacaoO2: 98, temperatura: 36.6 };
      mockSinaisVitaisService.criar.mockResolvedValue({ id: 'sv-1' });

      controller.criar('doente-1', dto as any, { user: { sub: 'user-1', role: 'enfermeiro' } } as any);

      expect(mockSinaisVitaisService.criar).toHaveBeenCalledWith(
        'doente-1', 'user-1', 'enfermeiro', dto,
      );
    });
  });

  // ── GET /sinais-vitais/:doenteId ──────────────────────────────────────────────

  describe('listar()', () => {
    it('chama assertAcessoDoente antes de service.listar', async () => {
      const callOrder: string[] = [];
      mockDoenteService.assertAcessoDoente.mockImplementation(async () => { callOrder.push('assert'); });
      mockSinaisVitaisService.listar.mockImplementation(async () => { callOrder.push('listar'); return []; });

      await controller.listar('doente-1', { user: { sub: 'u1', role: 'medico' } } as any);

      expect(callOrder).toEqual(['assert', 'listar']);
    });

    it('chama service.listar com doenteId', async () => {
      mockSinaisVitaisService.listar.mockResolvedValue([{ id: 'sv-1' }]);

      await controller.listar('doente-1', { user: { sub: 'u1', role: 'medico' } } as any);

      expect(mockSinaisVitaisService.listar).toHaveBeenCalledWith('doente-1');
    });
  });
});
