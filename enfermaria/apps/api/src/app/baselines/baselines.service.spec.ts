import { Test, TestingModule } from '@nestjs/testing';
import { BaselinesService } from './baselines.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';

const mockPrisma: any = {
  sinalVital: { findMany: jest.fn(), findFirst: jest.fn() },
  alertaSepsis: { findFirst: jest.fn(), findMany: jest.fn() },
  sinalizacaoPreocupante: { findMany: jest.fn() },
  baselineDoente: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
  alertaClinico: { create: jest.fn() },
  doente: { findMany: jest.fn() },
  $queryRaw: jest.fn(),
};

/** ARQ-23: o risco lê em lote — estes são os dados de UM doente ('doente-1'), na forma das consultas em lote. */
function dados({ sv = [] as any[], sepsis = null as any, sinal = [] as any[], baseline = null as any }) {
  mockPrisma.$queryRaw.mockResolvedValue(sv.map((x) => ({ doenteId: 'doente-1', ...x })));
  mockPrisma.alertaSepsis.findMany.mockResolvedValue(sepsis ? [{ doenteId: 'doente-1', ...sepsis }] : []);
  mockPrisma.sinalizacaoPreocupante.findMany.mockResolvedValue(sinal.map((x) => ({ doenteId: 'doente-1', ...x })));
  mockPrisma.baselineDoente.findMany.mockResolvedValue(baseline ? [{ doenteId: 'doente-1', ...baseline }] : []);
}

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
    dados({ sv: [{ ...svRecente, news2: 1 }], sepsis: null, sinal: [], baseline: null });

    const { banda, score } = await service.calcularRisco('doente-1');

    expect(banda).toBe('verde');
    expect(score).toBeLessThan(30);
  });

  it('retorna banda âmbar quando NEWS2=6', async () => {
    dados({ sv: [{ ...svRecente, news2: 6 }], sepsis: null, sinal: [], baseline: null });

    const { banda, score } = await service.calcularRisco('doente-1');

    expect(banda).toBe('ambar');
    expect(score).toBeGreaterThanOrEqual(30);
    expect(score).toBeLessThan(60);
  });

  it('retorna banda vermelho quando NEWS2=7 + sépsis activa', async () => {
    dados({ sv: [{ ...svRecente, news2: 7 }], sepsis: { id: 'sepsis-1' }, sinal: [], baseline: null });

    const { banda, score, factores } = await service.calcularRisco('doente-1');

    expect(banda).toBe('vermelho');
    expect(score).toBeGreaterThanOrEqual(60);
    expect(factores).toContain('Alerta sépsis activo');
  });

  it('adiciona +25 pts por sinalização urgente', async () => {
    dados({ sv: [{ ...svRecente, news2: 0 }], sepsis: null, sinal: [{ nivelUrgencia: 'urgente' }], baseline: null });

    const { score, factores } = await service.calcularRisco('doente-1');

    expect(score).toBeGreaterThanOrEqual(25);
    expect(factores).toContain('Sinalizado urgente');
  });

  it('adiciona +25 pts quando não há nenhum registo de SV', async () => {
    dados({ sv: [], sepsis: null, sinal: [], baseline: null });

    const { score, factores } = await service.calcularRisco('doente-1');

    expect(score).toBeGreaterThanOrEqual(25);
    expect(factores).toContain('Sem registos de SV');
  });

  it('score fica clampado a 100 mesmo com múltiplos factores críticos', async () => {
    // NEWS2=7(+50) + sépsis(+30) + urgente(+25) + sem SV recente já cobre > 100
    const svAntigo = { ...svRecente, news2: 7, data: new Date(Date.now() - 30 * 3_600_000) };
    dados({ sv: [svAntigo], sepsis: { id: 'sepsis-1' }, sinal: [{ nivelUrgencia: 'urgente' }], baseline: null });

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
    dados({ sv: svs, sepsis: null, sinal: [], baseline: null });

    const { factores } = await service.calcularRisco('doente-1');

    expect(factores).toContain('NEWS2 em subida');
  });

  it('ARQ-23: o risco do turno usa 4 consultas para todos os doentes (não ~6 por doente)', async () => {
    mockPrisma.doente.findMany.mockResolvedValue([
      { id: 'a', nome: 'A', cama: { numero: '1' } }, { id: 'b', nome: 'B', cama: { numero: '2' } }, { id: 'c', nome: 'C', cama: null },
    ]);
    mockPrisma.$queryRaw.mockResolvedValue([{ doenteId: 'a', ...svRecente, news2: 7 }, { doenteId: 'b', ...svRecente, news2: 0 }]);
    mockPrisma.alertaSepsis.findMany.mockResolvedValue([{ doenteId: 'a' }]);
    mockPrisma.sinalizacaoPreocupante.findMany.mockResolvedValue([]);
    mockPrisma.baselineDoente.findMany.mockResolvedValue([]);

    const r = await service.calcularRiscoTurno('');

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.alertaSepsis.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.sinalVital.findFirst).not.toHaveBeenCalled();
    expect(r.map((x) => [x.doenteId, x.banda])).toEqual([['a', 'vermelho'], ['c', 'verde'], ['b', 'verde']].sort((p, q) => (p[0] === 'a' ? -1 : q[0] === 'a' ? 1 : 0)) as any);
    expect(r.find((x) => x.doenteId === 'c')!.factores).toContain('Sem registos de SV');
    expect(r.find((x) => x.doenteId === 'a')!.ultimoSV).toEqual(svRecente.data);
  });
});
