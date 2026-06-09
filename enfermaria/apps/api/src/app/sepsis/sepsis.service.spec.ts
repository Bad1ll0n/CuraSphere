import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SepsisService } from './sepsis.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { EventsGateway } from '../gateway/events.gateway';

const mockPrisma = {
  alertaSepsis: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  doente: { findUnique: jest.fn() },
};

const mockAlertas = { criarAlerta: jest.fn().mockResolvedValue(undefined) };
const mockGateway = { server: { emit: jest.fn() } };

describe('SepsisService', () => {
  let service: SepsisService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAlertas.criarAlerta.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SepsisService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AlertasService, useValue: mockAlertas },
        { provide: EventsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<SepsisService>(SepsisService);
  });

  // ── calcularQSOFA() ──────────────────────────────────────────────────────────

  describe('calcularQSOFA()', () => {
    it('devolve 0 para parâmetros normais', () => {
      expect(service.calcularQSOFA({ frequenciaRespiratoria: 16, pressaoSistolica: 120 })).toBe(0);
    });

    it('devolve 1 quando FR >= 22', () => {
      expect(service.calcularQSOFA({ frequenciaRespiratoria: 22 })).toBe(1);
    });

    it('devolve 1 quando PA sistólica <= 100', () => {
      expect(service.calcularQSOFA({ pressaoSistolica: 100 })).toBe(1);
    });

    it('devolve 2 com FR >= 22 e PA <= 100 (critério positivo)', () => {
      expect(service.calcularQSOFA({ frequenciaRespiratoria: 25, pressaoSistolica: 90 })).toBe(2);
    });

    it('ignora campos null', () => {
      expect(service.calcularQSOFA({ frequenciaRespiratoria: null, pressaoSistolica: null })).toBe(0);
    });
  });

  // ── calcularSIRS() ──────────────────────────────────────────────────────────

  describe('calcularSIRS()', () => {
    it('devolve 0 para parâmetros normais', () => {
      expect(service.calcularSIRS({ temperatura: 37, pulso: 80, frequenciaRespiratoria: 16 })).toBe(0);
    });

    it('conta temperatura > 38', () => {
      expect(service.calcularSIRS({ temperatura: 38.5 })).toBe(1);
    });

    it('conta temperatura < 36', () => {
      expect(service.calcularSIRS({ temperatura: 35.8 })).toBe(1);
    });

    it('conta pulso > 90', () => {
      expect(service.calcularSIRS({ pulso: 95 })).toBe(1);
    });

    it('devolve 3 com todos os critérios SIRS (Temp + Pulso + FR)', () => {
      expect(service.calcularSIRS({ temperatura: 39, pulso: 100, frequenciaRespiratoria: 22 })).toBe(3);
    });
  });

  // ── avaliar() ────────────────────────────────────────────────────────────────

  describe('avaliar()', () => {
    it('não cria alerta quando qSOFA < 2 e SIRS < 2', async () => {
      await service.avaliar('doente-1', { frequenciaRespiratoria: 16, pressaoSistolica: 120, temperatura: 37, pulso: 80 });

      expect(mockPrisma.alertaSepsis.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.alertaSepsis.create).not.toHaveBeenCalled();
    });

    it('não cria duplicado quando já existe alerta recente', async () => {
      mockPrisma.alertaSepsis.findFirst.mockResolvedValue({ id: 'alerta-existente' });

      await service.avaliar('doente-1', { frequenciaRespiratoria: 25, pressaoSistolica: 90 });

      expect(mockPrisma.alertaSepsis.create).not.toHaveBeenCalled();
    });

    it('cria alerta sépsis quando qSOFA >= 2 e sem alerta recente', async () => {
      mockPrisma.alertaSepsis.findFirst.mockResolvedValue(null);
      mockPrisma.alertaSepsis.create.mockResolvedValue({ id: 'alerta-1' });
      mockPrisma.doente.findUnique.mockResolvedValue({ nome: 'Maria', cama: { numero: '12A' } });

      await service.avaliar('doente-1', { frequenciaRespiratoria: 25, pressaoSistolica: 90 });

      expect(mockPrisma.alertaSepsis.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ doenteId: 'doente-1', criterio: 'qsofa' }) }),
      );
      expect(mockGateway.server.emit).toHaveBeenCalledWith('sos:alerta', expect.objectContaining({ tipo: 'sepsis' }));
    });

    it('usa critério sirs quando SIRS >= 2 e qSOFA < 2', async () => {
      mockPrisma.alertaSepsis.findFirst.mockResolvedValue(null);
      mockPrisma.alertaSepsis.create.mockResolvedValue({ id: 'alerta-2' });
      mockPrisma.doente.findUnique.mockResolvedValue({ nome: 'João', cama: null });

      await service.avaliar('doente-1', { temperatura: 39, pulso: 100, frequenciaRespiratoria: 22, pressaoSistolica: 130 });

      expect(mockPrisma.alertaSepsis.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ criterio: 'sirs' }) }),
      );
    });
  });

  // ── resolver() ───────────────────────────────────────────────────────────────

  describe('resolver()', () => {
    it('lança NotFoundException quando alerta não existe', async () => {
      mockPrisma.alertaSepsis.findUnique.mockResolvedValue(null);

      await expect(service.resolver('id-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('marca alerta como resolvido', async () => {
      mockPrisma.alertaSepsis.findUnique.mockResolvedValue({ id: 'alerta-1' });
      mockPrisma.alertaSepsis.update.mockResolvedValue({});

      await service.resolver('alerta-1');

      expect(mockPrisma.alertaSepsis.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ resolvido: true }) }),
      );
    });
  });

  // ── atualizarBundle() ────────────────────────────────────────────────────────

  describe('atualizarBundle()', () => {
    it('lança NotFoundException quando alerta não existe', async () => {
      mockPrisma.alertaSepsis.findUnique.mockResolvedValue(null);

      await expect(service.atualizarBundle('id-inexistente', 'lactato')).rejects.toThrow(NotFoundException);
    });

    it('actualiza campo do bundle', async () => {
      mockPrisma.alertaSepsis.findUnique.mockResolvedValue({ id: 'alerta-1' });
      mockPrisma.alertaSepsis.update.mockResolvedValue({});

      await service.atualizarBundle('alerta-1', 'lactato');

      expect(mockPrisma.alertaSepsis.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lactato: true }) }),
      );
    });
  });

  // ── listarAtivos() ───────────────────────────────────────────────────────────

  describe('listarAtivos()', () => {
    it('devolve alertas activos para o doente', async () => {
      const alertas = [{ id: 'a1', criterio: 'qsofa', score: 2 }];
      mockPrisma.alertaSepsis.findMany.mockResolvedValue(alertas);

      const resultado = await service.listarAtivos('doente-1');

      expect(resultado).toEqual(alertas);
      expect(mockPrisma.alertaSepsis.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ doenteId: 'doente-1', resolvido: false }) }),
      );
    });
  });
});
