import { Test, TestingModule } from '@nestjs/testing';
import { FaturacaoController } from './faturacao.controller';
import { FaturacaoService } from './faturacao.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

const mockFaturacaoService = {
  listar: jest.fn(),
  resumo: jest.fn(),
  criar: jest.fn(),
  buscarPorId: jest.fn(),
  listarPorDoente: jest.fn(),
  adicionarItem: jest.fn(),
  removerItem: jest.fn(),
  registarPagamento: jest.fn(),
  mudarEstado: jest.fn(),
};

const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('FaturacaoController', () => {
  let controller: FaturacaoController;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockGuard.canActivate.mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FaturacaoController],
      providers: [{ provide: FaturacaoService, useValue: mockFaturacaoService }],
    })
      .overrideGuard(JwtAuthGuard).useValue(mockGuard)
      .overrideGuard(RolesGuard).useValue(mockGuard)
      .compile();

    controller = module.get<FaturacaoController>(FaturacaoController);
  });

  // ── GET /faturacao ────────────────────────────────────────────────────────────

  describe('listar()', () => {
    it('chama faturacaoService.listar com estado, page e limit', () => {
      mockFaturacaoService.listar.mockResolvedValue({ data: [], total: 0 });

      controller.listar('pendente', '1', '25');

      expect(mockFaturacaoService.listar).toHaveBeenCalledWith('pendente', 1, 25);
    });

    it('limita a 100 quando limit excessivo é pedido', () => {
      mockFaturacaoService.listar.mockResolvedValue({ data: [], total: 0 });

      controller.listar(undefined, '1', '999');

      expect(mockFaturacaoService.listar).toHaveBeenCalledWith(undefined, 1, 100);
    });
  });

  // ── POST /faturacao/:id/pagamento ─────────────────────────────────────────────

  describe('registarPagamento()', () => {
    it('chama service.registarPagamento com id e dto incluindo registadoPorId', () => {
      const dto = { montante: 150, metodoPagamento: 'mbway' };
      mockFaturacaoService.registarPagamento.mockResolvedValue({ id: 'fat-1' });

      controller.registarPagamento('fat-1', dto as any, { user: { sub: 'admin-1' } } as any);

      expect(mockFaturacaoService.registarPagamento).toHaveBeenCalledWith(
        'fat-1',
        expect.objectContaining({ montante: 150, registadoPorId: 'admin-1' }),
      );
    });
  });
});
