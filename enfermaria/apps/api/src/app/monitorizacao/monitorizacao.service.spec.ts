import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { MonitorizacaoService } from './monitorizacao.service';
import { LeiturasMonitorService } from './leituras-monitor.service';
import { PrismaService } from '../prisma/prisma.service';
import { SinaisVitaisService } from '../sinais-vitais/sinais-vitais.service';
import { AlertasService } from '../alertas/alertas.service';

const mockPrisma = {
  utilizador: { findUnique: jest.fn() },
  doente: { findUnique: jest.fn(), findFirst: jest.fn() },
  cama: { findUnique: jest.fn() },
  dispositivoMonitor: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  leituraMonitor: { create: jest.fn() },
};
const mockSinais = { ingerirDeMonitor: jest.fn() };
const mockAlertas = { criarAlerta: jest.fn().mockResolvedValue(undefined) };

describe('MonitorizacaoService', () => {
  let service: MonitorizacaoService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.leituraMonitor.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'lm-1', ...data }));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorizacaoService,
        LeiturasMonitorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SinaisVitaisService, useValue: mockSinais },
        { provide: AlertasService, useValue: mockAlertas },
      ],
    }).compile();
    service = module.get(MonitorizacaoService);
  });

  describe('registarDispositivo()', () => {
    it('rejeita quando o responsável não existe', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue(null);
      await expect(service.registarDispositivo({ nome: 'M1', responsavelId: 'x' } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejeita uma cama que não existe', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.cama.findUnique.mockResolvedValue(null);
      await expect(service.registarDispositivo({ nome: 'M1', responsavelId: 'u1', camaId: 'c-x' } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('devolve a apiKey no formato <id>.<secret> e guarda só o hash', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.dispositivoMonitor.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'disp-1', ...data }));
      const r = await service.registarDispositivo({ nome: 'Monitor Cama 1', responsavelId: 'u1' } as any);
      expect(r.apiKey.startsWith('disp-1.')).toBe(true);
      const dataGuardada = mockPrisma.dispositivoMonitor.create.mock.calls[0][0].data;
      expect(dataGuardada.apiKeyHash).toBeTruthy();
      expect(dataGuardada.apiKeyHash).not.toContain('disp-1'); // não guarda o segredo em claro
    });
  });

  describe('ingerir()', () => {
    const secret = 'segredo-certo';
    const comChave = async (extra: Record<string, unknown> = {}) => {
      const hash = await bcrypt.hash(secret, 4);
      mockPrisma.dispositivoMonitor.findUnique.mockResolvedValue({ id: 'disp-1', ativo: true, apiKeyHash: hash, doenteId: 'd1', camaId: null, responsavelId: 'u1', ...extra });
      mockPrisma.dispositivoMonitor.update.mockResolvedValue({});
    };

    it('chave em falta → 401', async () => {
      await expect(service.ingerir(undefined, {} as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('chave com segredo errado → 401', async () => {
      await comChave();
      await expect(service.ingerir('disp-1.segredo-errado', {} as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('PROD-15: chave válida → leitura PENDENTE de validação, sem passar logo pelo NEWS2 nem em nome do responsável', async () => {
      await comChave();
      const r = await service.ingerir(`disp-1.${secret}`, { pulso: 130, saturacaoO2: 84 } as any);
      expect(r).toEqual({ ok: true, leituraId: 'lm-1', estado: 'pendente_validacao', critica: true });
      expect(mockSinais.ingerirDeMonitor).not.toHaveBeenCalled();
      expect(mockPrisma.leituraMonitor.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ doenteId: 'd1', dispositivoId: 'disp-1', canal: 'monitor', valores: { pulso: 130, saturacaoO2: 84 } }),
      );
      // Valor crítico: alerta já, sem esperar pela validação.
      expect(mockAlertas.criarAlerta).toHaveBeenCalledWith('d1', 'leitura_monitor_critica', expect.any(String), 3);
    });

    it('PROD-15: o doente do payload não escolhe — se for outro, recusa', async () => {
      await comChave();
      await expect(service.ingerir(`disp-1.${secret}`, { doenteId: 'outro', pulso: 80 } as any)).rejects.toThrow(/doente diferente/);
      expect(mockPrisma.leituraMonitor.create).not.toHaveBeenCalled();
    });

    it('PROD-15: monitor ligado a uma cama → o doente é quem a ocupa; cama vazia → recusa', async () => {
      await comChave({ doenteId: null, camaId: 'c1' });
      mockPrisma.doente.findFirst.mockResolvedValueOnce({ id: 'ocupante' });
      await service.ingerir(`disp-1.${secret}`, { pulso: 80 } as any);
      expect(mockPrisma.leituraMonitor.create.mock.calls[0][0].data.doenteId).toBe('ocupante');

      mockPrisma.doente.findFirst.mockResolvedValueOnce(null);
      await expect(service.ingerir(`disp-1.${secret}`, { pulso: 80 } as any)).rejects.toThrow(/não tem doente internado/);
    });

    it('PROD-15: hora da medição no futuro (relógio errado) é recusada', async () => {
      await comChave();
      const futuro = new Date(Date.now() + 3_600_000).toISOString();
      await expect(service.ingerir(`disp-1.${secret}`, { pulso: 80, medidoEm: futuro } as any)).rejects.toThrow(/futuro/);
    });
  });

  describe('revogarDispositivo()', () => {
    it('lança NotFoundException quando não existe', async () => {
      mockPrisma.dispositivoMonitor.findUnique.mockResolvedValue(null);
      await expect(service.revogarDispositivo('x')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
