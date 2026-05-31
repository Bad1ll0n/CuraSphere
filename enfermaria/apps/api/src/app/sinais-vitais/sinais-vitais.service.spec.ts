import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SinaisVitaisService } from './sinais-vitais.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { ProtocolosService } from '../protocolos/protocolos.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  sinalVital: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
};

const mockAlertas = { criarAlerta: jest.fn() };
const mockNotificacoes = { enviarParaDoente: jest.fn().mockResolvedValue(undefined) };
const mockProtocolos = { ativarSeNaoAtivo: jest.fn().mockResolvedValue(undefined) };

const mockDoente = { id: 'd1', nome: 'Maria Santos', ativo: true };

describe('SinaisVitaisService', () => {
  let service: SinaisVitaisService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SinaisVitaisService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AlertasService, useValue: mockAlertas },
        { provide: NotificacoesService, useValue: mockNotificacoes },
        { provide: ProtocolosService, useValue: mockProtocolos },
      ],
    }).compile();

    service = module.get<SinaisVitaisService>(SinaisVitaisService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockNotificacoes.enviarParaDoente.mockResolvedValue(undefined);
    mockProtocolos.ativarSeNaoAtivo.mockResolvedValue(undefined);
  });

  // ── criar() — controlo de acesso ──────────────────────────────────────────

  describe('criar() — controlo de acesso e validação', () => {
    it('lança ForbiddenException para role sem permissão', async () => {
      await expect(
        service.criar('d1', 'u1', 'administrativo', { pulso: 70 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.criar('d1', 'u1', 'enfermeiro', { pulso: 70 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando doente está inativo', async () => {
      mockPrisma.doente.findUnique.mockResolvedValueOnce({ id: 'd1', ativo: false });
      await expect(
        service.criar('d1', 'u1', 'enfermeiro', { pulso: 70 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── criar() — NEWS2 = 0 (parâmetros normais) ─────────────────────────────

  describe('criar() — NEWS2 scoring', () => {
    const mockRegisto = { id: 'sv1', doenteId: 'd1', news2: 0 };

    beforeEach(() => {
      mockPrisma.doente.findUnique.mockResolvedValue(mockDoente);
      mockPrisma.sinalVital.create.mockResolvedValue(mockRegisto);
    });

    it('NEWS2 = 0 para parâmetros todos normais (FR=15, SpO2=98, Temp=37, PA=120, FC=70)', async () => {
      const result = await service.criar('d1', 'u1', 'enfermeiro', {
        frequenciaRespiratoria: 15,
        saturacaoO2: 98,
        temperatura: 37,
        pressaoSistolica: 120,
        pulso: 70,
      });

      expect(mockPrisma.sinalVital.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ news2: 0 }) }),
      );
      expect(mockAlertas.criarAlerta).not.toHaveBeenCalled();
    });

    it('NEWS2 = 9 para parâmetros críticos (FR=28, SpO2=89, PA=85) → activa protocolo sepsis', async () => {
      // FR=28 → +3, SpO2=89 → +3, PA=85 → +3 = total 9
      mockPrisma.sinalVital.create.mockResolvedValue({ ...mockRegisto, news2: 9 });

      await service.criar('d1', 'u1', 'enfermeiro', {
        frequenciaRespiratoria: 28,
        saturacaoO2: 89,
        pressaoSistolica: 85,
      });

      expect(mockAlertas.criarAlerta).toHaveBeenCalledWith('d1', 'news2_critico', expect.stringContaining('CRÍTICO'));
      expect(mockProtocolos.ativarSeNaoAtivo).toHaveBeenCalledWith('d1', 'sepsis');
    });

    it('NEWS2 = 5 (moderado, FR=22, SpO2=94, PA=105) → alerta NEWS2 alto sem protocolo', async () => {
      // FR=22 → +2, SpO2=94 → +1, PA=105 → +1 = total 4, mas podemos usar valores que dão 5
      // FR=25(+3), SpO2=94(+1), PA=115(0), Temp=36.5(0), FC=75(0) → 4, adicionar AVPU='V'(+3) = 7 — não
      // Melhor: FR=22(+2), SpO2=93(+2), temp=36(+1) = 5
      mockPrisma.sinalVital.create.mockResolvedValue({ ...mockRegisto, news2: 5 });

      await service.criar('d1', 'u1', 'enfermeiro', {
        frequenciaRespiratoria: 22,
        saturacaoO2: 93,
        temperatura: 36.0,
      });

      expect(mockAlertas.criarAlerta).toHaveBeenCalledWith('d1', 'news2_alto', expect.stringContaining('ALTO'));
      expect(mockProtocolos.ativarSeNaoAtivo).not.toHaveBeenCalled();
    });

    it('não calcula NEWS2 com menos de 3 parâmetros presentes', async () => {
      mockPrisma.sinalVital.create.mockResolvedValue({ id: 'sv1', doenteId: 'd1' });

      await service.criar('d1', 'u1', 'enfermeiro', { pulso: 70, temperatura: 37.0 });

      const createCall = mockPrisma.sinalVital.create.mock.calls[0][0];
      expect(createCall.data).not.toHaveProperty('news2');
    });

    it('AVPU != A adiciona +3 ao NEWS2', async () => {
      // SpO2=96(0), Temp=37(0), PA=120(0), FC=70(0), FR=15(0) + AVPU='V'(+3) = 3
      mockPrisma.sinalVital.create.mockResolvedValue({ ...mockRegisto, news2: 3 });

      await service.criar('d1', 'u1', 'enfermeiro', {
        frequenciaRespiratoria: 15,
        saturacaoO2: 96,
        temperatura: 37,
        avpu: 'V',
      });

      expect(mockPrisma.sinalVital.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ news2: 3 }) }),
      );
    });
  });

  // ── criar() — alertas de sinais críticos individuais ─────────────────────

  describe('criar() — alertas de valores críticos individuais', () => {
    beforeEach(() => {
      mockPrisma.doente.findUnique.mockResolvedValue(mockDoente);
      mockPrisma.sinalVital.create.mockResolvedValue({ id: 'sv1' });
    });

    it('SpO2 < 90 gera alerta sinal_vital_critico', async () => {
      await service.criar('d1', 'u1', 'enfermeiro', { saturacaoO2: 88 });

      expect(mockAlertas.criarAlerta).toHaveBeenCalledWith(
        'd1',
        'sinal_vital_critico',
        expect.stringContaining('SpO₂ crítica'),
      );
    });

    it('Pulso > 120 gera alerta sinal_vital_critico', async () => {
      await service.criar('d1', 'u1', 'medico', { pulso: 135 });

      expect(mockAlertas.criarAlerta).toHaveBeenCalledWith(
        'd1',
        'sinal_vital_critico',
        expect.stringContaining('Pulso crítico'),
      );
    });

    it('TA sistólica < 80 gera alerta sinal_vital_critico', async () => {
      await service.criar('d1', 'u1', 'enfermeiro', { pressaoSistolica: 70 });

      expect(mockAlertas.criarAlerta).toHaveBeenCalledWith(
        'd1',
        'sinal_vital_critico',
        expect.stringContaining('TA sistólica crítica'),
      );
    });
  });

  // ── analisarTendencia() ──────────────────────────────────────────────────

  describe('analisarTendencia()', () => {
    it('retorna risco indeterminado com menos de 2 registos', async () => {
      mockPrisma.sinalVital.findMany.mockResolvedValueOnce([
        { data: new Date(), pressaoSistolica: 120, pulso: 70, saturacaoO2: 98, frequenciaRespiratoria: 15, temperatura: 37, news2: 1 },
      ]);

      const result = await service.analisarTendencia('d1');
      expect(result.risco).toBe('indeterminado');
    });

    it('detecta risco alto quando NEWS2 atual ≥ 7', async () => {
      const registos = Array.from({ length: 4 }, (_, i) => ({
        data: new Date(),
        pressaoSistolica: 120, pulso: 70, saturacaoO2: 98,
        frequenciaRespiratoria: 15, temperatura: 37,
        news2: 7 + i,
      }));
      mockPrisma.sinalVital.findMany.mockResolvedValueOnce(registos);

      const result = await service.analisarTendencia('d1');
      expect(result.risco).toBe('alto');
    });

    it('detecta risco baixo com parâmetros estáveis e NEWS2 baixo', async () => {
      const registos = Array.from({ length: 3 }, () => ({
        data: new Date(),
        pressaoSistolica: 120, pulso: 72, saturacaoO2: 98,
        frequenciaRespiratoria: 16, temperatura: 36.8,
        news2: 0,
      }));
      mockPrisma.sinalVital.findMany.mockResolvedValueOnce(registos);

      const result = await service.analisarTendencia('d1');
      expect(result.risco).toBe('baixo');
      expect(result.alertas).toBe(0);
    });

    it('detecta deterioração quando SpO2 em queda progressiva', async () => {
      const registos = [98, 95, 92, 90].map((spo2, i) => ({
        data: new Date(),
        pressaoSistolica: 120, pulso: 72, frequenciaRespiratoria: 16,
        temperatura: 36.8, news2: i + 1,
        saturacaoO2: spo2,
      }));
      mockPrisma.sinalVital.findMany.mockResolvedValueOnce(registos);

      const result = await service.analisarTendencia('d1');
      const spo2Tendencia = result.tendencias.find(t => t.parametro === 'SpO₂ (%)');
      expect(spo2Tendencia?.alerta).toBe(true);
    });
  });
});
