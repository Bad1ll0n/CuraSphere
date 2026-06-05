import { Test, TestingModule } from '@nestjs/testing';
import { AiClinicoService } from './ai-clinico.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock do SDK Anthropic antes de importar o service
jest.mock('@anthropic-ai/sdk', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  };
});

import Anthropic from '@anthropic-ai/sdk';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  sinalVital: { findMany: jest.fn() },
  medicacao: { findMany: jest.fn() },
  alertaClinico: { findMany: jest.fn() },
  sinalizacaoPreocupante: { findMany: jest.fn() },
  baselineDoente: { findUnique: jest.fn() },
  alertaSepsis: { findFirst: jest.fn() },
};

const respostaMediaco = JSON.stringify({
  observacoes: ['FC estável nas últimas 24h', 'SpO2 dentro dos parâmetros'],
  padroesDetectados: ['Ligeiro aumento de FR'],
  investigacoesAConsiderar: ['Gasimetria arterial se FR persistir'],
  disclaimer: 'Apoio à decisão clínica. Não substitui avaliação médica.',
});

const respostaEnfermeiro = JSON.stringify({
  observacoes: ['FC e SpO2 estáveis'],
  disclaimer: 'Apoio à decisão clínica. Não substitui avaliação médica.',
});

describe('AiClinicoService', () => {
  let service: AiClinicoService;
  let mockMessagesCreate: jest.Mock;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiClinicoService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AiClinicoService>(AiClinicoService);

    // Obter referência ao mock do método create
    const instance = (Anthropic as jest.Mock).mock.results[0]?.value;
    mockMessagesCreate = instance?.messages?.create ?? jest.fn();

    // Dados base para os testes
    mockPrisma.doente.findUnique.mockResolvedValue({ nome: 'João Silva', diagnosticoPrincipal: 'Pneumonia', dataAdmissao: new Date(), servico: 'medicina' });
    mockPrisma.sinalVital.findMany.mockResolvedValue([{ data: new Date(), news2: 3, pulso: 80, pressaoSistolica: 120, pressaoDiastolica: 80, temperatura: 37.5, saturacaoO2: 96, frequenciaRespiratoria: 18 }]);
    mockPrisma.medicacao.findMany.mockResolvedValue([{ nome: 'Amoxicilina', dose: '1g', via: 'IV' }]);
    mockPrisma.alertaClinico.findMany.mockResolvedValue([]);
    mockPrisma.sinalizacaoPreocupante.findMany.mockResolvedValue([]);
    mockPrisma.baselineDoente.findUnique.mockResolvedValue(null);
    mockPrisma.alertaSepsis.findFirst.mockResolvedValue(null);
  });

  it('chama a API Anthropic e devolve observações para role médico', async () => {
    mockMessagesCreate.mockResolvedValue({ content: [{ type: 'text', text: respostaMediaco }] });

    const resultado = await service.analisar('doente-1', 'medico');

    expect(resultado.observacoes).toBeDefined();
    expect(resultado.investigacoesAConsiderar).toBeDefined();
    expect(resultado.disclaimer).toContain('Não substitui avaliação médica');
  });

  it('role enfermeiro não recebe investigacoesAConsiderar', async () => {
    mockMessagesCreate.mockResolvedValue({ content: [{ type: 'text', text: respostaEnfermeiro }] });

    const resultado = await service.analisar('doente-1', 'enfermeiro');

    expect(resultado.observacoes).toBeDefined();
    expect(resultado.investigacoesAConsiderar).toBeUndefined();
  });

  it('segunda chamada para o mesmo (doenteId + role) não invoca Anthropic novamente', async () => {
    mockMessagesCreate.mockResolvedValue({ content: [{ type: 'text', text: respostaMediaco }] });

    await service.analisar('doente-cache', 'medico');
    await service.analisar('doente-cache', 'medico');

    // A API Anthropic só deve ter sido chamada uma vez (cache hit na segunda)
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });

  it('diferentes roles para o mesmo doente são caches separadas', async () => {
    mockMessagesCreate
      .mockResolvedValueOnce({ content: [{ type: 'text', text: respostaMediaco }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: respostaEnfermeiro }] });

    await service.analisar('doente-2', 'medico');
    await service.analisar('doente-2', 'enfermeiro');

    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
  });
});
