// virtual: true — ver nota em doentes.controller.spec.ts (resolução inconsistente do caminho).
jest.mock('pdfmake/src/printer', () => {
  return function() { return { createPdfKitDocument: jest.fn().mockReturnValue({ pipe: jest.fn(), end: jest.fn(), on: jest.fn() }) }; };
}, { virtual: true });

import { Test, TestingModule } from '@nestjs/testing';
import { MedicacaoController } from './medicacao.controller';
import { MedicacaoService } from './medicacao.service';
import { DoenteService } from '../doentes/doentes.service';
import { PdfService } from '../common/pdf.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

const mockMedicacaoService = {
  prescrever: jest.fn(),
  proporPrescricao: jest.fn(),
  aprovarPrescricaoMedico: jest.fn(),
  rejeitarPrescricaoMedico: jest.fn(),
  pendentesAprovacaoMedico: jest.fn(),
  registarAdministracao: jest.fn(),
  naoAdministrar: jest.fn(),
  suspender: jest.fn(),
  listarPorDoente: jest.fn(),
  historicoAdministracao: jest.fn(),
};

const mockDoenteService = {
  assertAcessoDoente: jest.fn().mockResolvedValue(undefined),
};

const mockPdfService = {
  gerarRelatorioAlta: jest.fn(),
};

const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('MedicacaoController', () => {
  let controller: MedicacaoController;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockGuard.canActivate.mockReturnValue(true);
    mockDoenteService.assertAcessoDoente.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedicacaoController],
      providers: [
        { provide: MedicacaoService, useValue: mockMedicacaoService },
        { provide: DoenteService, useValue: mockDoenteService },
        { provide: PdfService, useValue: mockPdfService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(mockGuard)
      .overrideGuard(RolesGuard).useValue(mockGuard)
      .compile();

    controller = module.get<MedicacaoController>(MedicacaoController);
  });

  // ── POST /medicacao/prescrever ────────────────────────────────────────────────

  describe('prescrever()', () => {
    it('chama medicacaoService.prescrever com dto e prescritoPorId', () => {
      const dto = { doenteId: 'd1', nome: 'Ibuprofeno', dose: '400mg', via: 'oral', frequencia: '8/8h' };
      mockMedicacaoService.prescrever.mockResolvedValue({ id: 'med-1' });

      controller.prescrever(dto as any, { user: { sub: 'medico-1' } } as any);

      expect(mockMedicacaoService.prescrever).toHaveBeenCalledWith(
        expect.objectContaining({ doenteId: 'd1', prescritoPorId: 'medico-1' }),
      );
    });
  });

  // ── POST /medicacao/:id/administrar ───────────────────────────────────────────

  describe('registarAdministracao()', () => {
    it('chama service.registarAdministracao com id e dto', () => {
      const dto = { doenteId: 'd1', administradoEm: new Date().toISOString() };
      mockMedicacaoService.registarAdministracao.mockResolvedValue({ id: 'reg-1' });

      controller.registarAdministracao('med-1', dto as any, { user: { sub: 'enf-1' } } as any);

      expect(mockMedicacaoService.registarAdministracao).toHaveBeenCalledWith(
        expect.objectContaining({ medicacaoId: 'med-1', doenteId: 'd1' }),
      );
    });
  });

  // ── PATCH /medicacao/:id/aprovar-medico ───────────────────────────────────────

  describe('aprovarPrescricaoMedico()', () => {
    it('chama service.aprovarPrescricaoMedico com id e medicoId', () => {
      mockMedicacaoService.aprovarPrescricaoMedico.mockResolvedValue({ id: 'med-1', estado: 'aprovada' });

      controller.aprovarPrescricaoMedico('med-1', { user: { sub: 'medico-1' } } as any);

      expect(mockMedicacaoService.aprovarPrescricaoMedico).toHaveBeenCalledWith('med-1', 'medico-1');
    });
  });
});
