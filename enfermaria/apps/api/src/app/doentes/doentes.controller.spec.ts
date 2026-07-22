// virtual: true — o caminho `pdfmake/src/printer` é resolvido de forma inconsistente entre
// ambientes (pnpm estrito no CI vs local); virtual evita exigir a resolução do módulo real.
jest.mock('pdfmake/src/printer', () => {
  return function() { return { createPdfKitDocument: jest.fn().mockReturnValue({ pipe: jest.fn(), end: jest.fn(), on: jest.fn() }) }; };
}, { virtual: true });

import { Test, TestingModule } from '@nestjs/testing';
import { DoenteController } from './doentes.controller';
import { DoenteService } from './doentes.service';
import { PdfService } from '../common/pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

const mockDoenteService = {
  listar: jest.fn(),
  exportarCsv: jest.fn(),
  buscarPorId: jest.fn(),
  assertAcessoDoente: jest.fn().mockResolvedValue(undefined),
  admitir: jest.fn(),
  editar: jest.fn(),
  atualizarEstado: jest.fn(),
  darAlta: jest.fn(),
  adicionarNota: jest.fn(),
  editarNota: jest.fn(),
  altaEstruturada: jest.fn(),
  historico: jest.fn(),
  listarRegistosAdministrativos: jest.fn(),
  registroRapido: jest.fn(),
  criarTarefa: jest.fn(),
  criarProblema: jest.fn(),
  atualizarProblema: jest.fn(),
  listarProblemas: jest.fn(),
};

const mockPdfService = {
  gerarRelatorioAlta: jest.fn(),
};

const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('DoenteController', () => {
  let controller: DoenteController;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockGuard.canActivate.mockReturnValue(true);
    mockDoenteService.assertAcessoDoente.mockResolvedValue(undefined);
    mockDoenteService.listar.mockResolvedValue({ data: [], total: 0 });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DoenteController],
      providers: [
        { provide: DoenteService, useValue: mockDoenteService },
        { provide: PdfService, useValue: mockPdfService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(mockGuard)
      .overrideGuard(RolesGuard).useValue(mockGuard)
      .compile();

    controller = module.get<DoenteController>(DoenteController);
  });

  // ── GET /doentes ──────────────────────────────────────────────────────────────

  describe('listar()', () => {
    it('role direcao com todos=true passa role=todos ao service', () => {
      const req = { user: { sub: 'u1', role: 'direcao' } };

      controller.listar(req as any, 'true', '1', '25');

      expect(mockDoenteService.listar).toHaveBeenCalledWith(
        'u1', 'todos', 1, 25,
      );
    });

    it('limita a 100 quando limit=500 é pedido', () => {
      const req = { user: { sub: 'u1', role: 'ti' } };

      controller.listar(req as any, undefined, '1', '500');

      expect(mockDoenteService.listar).toHaveBeenCalledWith(
        'u1', 'ti', 1, 100,
      );
    });

    it('role clínico com todos=true NÃO bypassa o filtro', () => {
      const req = { user: { sub: 'u1', role: 'enfermeiro' } };

      controller.listar(req as any, 'true', '1', '25');

      expect(mockDoenteService.listar).toHaveBeenCalledWith(
        'u1', 'enfermeiro', 1, 25,
      );
    });
  });

  // ── GET /doentes/:id ──────────────────────────────────────────────────────────

  describe('buscarPorId()', () => {
    it('chama assertAcessoDoente antes de buscarPorId', async () => {
      mockDoenteService.buscarPorId.mockResolvedValue({ id: 'doente-1' });
      const callOrder: string[] = [];
      mockDoenteService.assertAcessoDoente.mockImplementation(async () => { callOrder.push('assert'); });
      mockDoenteService.buscarPorId.mockImplementation(async () => { callOrder.push('buscar'); return { id: 'doente-1' }; });

      await controller.buscarPorId('doente-1', { user: { sub: 'u1', role: 'medico' }, headers: {} } as any);

      expect(callOrder).toEqual(['assert', 'buscar']);
    });
  });

  // ── POST /doentes/admitir ─────────────────────────────────────────────────────

  describe('admitir()', () => {
    it('chama doenteService.admitir com dto e administrativoAdmissaoId', () => {
      const dto = {
        nome: 'João', dataNascimento: '1990-01-01',
        diagnosticoPrincipal: 'Pneumonia', camaId: 'cama-1',
      };
      mockDoenteService.admitir.mockResolvedValue({ id: 'doente-novo' });

      controller.admitir(dto as any, { user: { sub: 'admin-1' } } as any);

      expect(mockDoenteService.admitir).toHaveBeenCalledWith(
        expect.objectContaining({
          nome: 'João',
          administrativoAdmissaoId: 'admin-1',
        }),
      );
    });
  });

  // ── GET /doentes/export ───────────────────────────────────────────────────────

  describe('exportarCsv()', () => {
    it('chama doenteService.exportarCsv e envia resultado via res.send', async () => {
      const mockRes = { send: jest.fn() };
      mockDoenteService.exportarCsv.mockResolvedValue('Nome,NIF\nJoão,123');

      await controller.exportarCsv(mockRes as any);

      expect(mockDoenteService.exportarCsv).toHaveBeenCalled();
      expect(mockRes.send).toHaveBeenCalledWith('Nome,NIF\nJoão,123');
    });
  });
});
