import { Test, TestingModule } from '@nestjs/testing';
import { BaselinesService } from './baselines.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';

const mockPrisma = {
  sinalVital: { findMany: jest.fn(), findFirst: jest.fn() },
  alertaSepsis: { findFirst: jest.fn() },
  sinalizacaoPreocupante: { findMany: jest.fn() },
  baselineDoente: { findUnique: jest.fn(), upsert: jest.fn() },
  alertaClinico: { create: jest.fn() },
  doente: { findMany: jest.fn() },
};

const mockAlertas = {
  criarAlerta: jest.fn().mockResolvedValue({}),
};

const agora = new Date();
const svRecente = { news2: 2, data: agora, pulso: 70, pressaoSistolica: 120, pressaoDiastolica: 80, temperatura: 36.8, saturacaoO2: 98, frequenciaRespiratoria: 16 };

describe('BaselinesService.calcularRisco()', () => {
  let service: BaselinesService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaselinesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AlertasService, useValue: mockAlertas },
      ],
    }).compile();
    service = module.get<BaselinesService>(BaselinesService);
  });

  it('retorna banda verde e score baixo quando doente estável sem complicações', async () => {
    mockPrisma.sinalVital.findMany.mockResolvedValue([{ ...svRecente, news2: 1 }]);
    mockPrisma.alertaSepsis.findFirst.mockResolvedValue(null);
    mockPrisma.sinalizacaoPreocupante.findMany.mockResolvedValue([]);
    mockPrisma.baselineDoente.findUnique.mockResolvedValue(null);

    const { banda, score } = await service.calcularRisco('doente-1');

    expect(banda).toBe('verde');
    expect(score).toBeLessThan(30);
  });

  it('retorna banda âmbar quando NEWS2=6', async () => {
    mockPrisma.sinalVital.findMany.mockResolvedValue([{ ...svRecente, news2: 6 }]);
    mockPrisma.alertaSepsis.findFirst.mockResolvedValue(null);
    mockPrisma.sinalizacaoPreocupante.findMany.mockResolvedValue([]);
    mockPrisma.baselineDoente.findUnique.mockResolvedValue(null);

    const { banda, score } = await service.calcularRisco('doente-1');

    expect(banda).toBe('ambar');
    expect(score).toBeGreaterThanOrEqual(30);
    expect(score).toBeLessThan(60);
  });

  it('retorna banda vermelho quando NEWS2=7 + sépsis activa', async () => {
    mockPrisma.sinalVital.findMany.mockResolvedValue([{ ...svRecente, news2: 7 }]);
    mockPrisma.alertaSepsis.findFirst.mockResolvedValue({ id: 'sepsis-1' });
    mockPrisma.sinalizacaoPreocupante.findMany.mockResolvedValue([]);
    mockPrisma.baselineDoente.findUnique.mockResolvedValue(null);

    const { banda, score, factores } = await service.calcularRisco('doente-1');

    expect(banda).toBe('vermelho');
    expect(score).toBeGreaterThanOrEqual(60);
    expect(factores).toContain('Alerta sépsis activo');
  });

  it('adiciona +25 pts por sinalização urgente', async () => {
    mockPrisma.sinalVital.findMany.mockResolvedValue([{ ...svRecente, news2: 0 }]);
    mockPrisma.alertaSepsis.findFirst.mockResolvedValue(null);
    mockPrisma.sinalizacaoPreocupante.findMany.mockResolvedValue([{ nivelUrgencia: 'urgente' }]);
    mockPrisma.baselineDoente.findUnique.mockResolvedValue(null);

    const { score, factores } = await service.calcularRisco('doente-1');

    expect(score).toBeGreaterThanOrEqual(25);
    expect(factores).toContain('Sinalizado urgente');
  });

  it('adiciona +25 pts quando não há nenhum registo de SV', async () => {
    mockPrisma.sinalVital.findMany.mockResolvedValue([]);
    mockPrisma.alertaSepsis.findFirst.mockResolvedValue(null);
    mockPrisma.sinalizacaoPreocupante.findMany.mockResolvedValue([]);
    mockPrisma.baselineDoente.findUnique.mockResolvedValue(null);

    const { score, factores } = await service.calcularRisco('doente-1');

    expect(score).toBeGreaterThanOrEqual(25);
    expect(factores).toContain('Sem registos de SV');
  });

  it('score fica clampado a 100 mesmo com múltiplos factores críticos', async () => {
    // NEWS2=7(+50) + sépsis(+30) + urgente(+25) + sem SV recente já cobre > 100
    const svAntigo = { ...svRecente, news2: 7, data: new Date(Date.now() - 30 * 3_600_000) };
    mockPrisma.sinalVital.findMany.mockResolvedValue([svAntigo]);
    mockPrisma.alertaSepsis.findFirst.mockResolvedValue({ id: 'sepsis-1' });
    mockPrisma.sinalizacaoPreocupante.findMany.mockResolvedValue([{ nivelUrgencia: 'urgente' }]);
    mockPrisma.baselineDoente.findUnique.mockResolvedValue(null);

    const { score } = await service.calcularRisco('doente-1');

    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it('tendência NEWS2 em subida adiciona factor', async () => {
    const svs = [
      { ...svRecente, news2: 5, data: agora },
      { ...svRecente, news2: 3, data: new Date(Date.now() - 3_600_000) },
      { ...svRecente, news2: 1, data: new Date(Date.now() - 7_200_000) },
    ];
    mockPrisma.sinalVital.findMany.mockResolvedValue(svs);
    mockPrisma.alertaSepsis.findFirst.mockResolvedValue(null);
    mockPrisma.sinalizacaoPreocupante.findMany.mockResolvedValue([]);
    mockPrisma.baselineDoente.findUnique.mockResolvedValue(null);

    const { factores } = await service.calcularRisco('doente-1');

    expect(factores).toContain('NEWS2 em subida');
  });
});
