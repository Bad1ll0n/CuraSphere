import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { MonitorizacaoService } from './monitorizacao.service';
import { PrismaService } from '../prisma/prisma.service';
import { SinaisVitaisService } from '../sinais-vitais/sinais-vitais.service';

const mockPrisma = {
  utilizador: { findUnique: jest.fn() },
  doente: { findUnique: jest.fn() },
  dispositivoMonitor: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
};
const mockSinais = { ingerirDeMonitor: jest.fn() };

describe('MonitorizacaoService', () => {
  let service: MonitorizacaoService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorizacaoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SinaisVitaisService, useValue: mockSinais },
      ],
    }).compile();
    service = module.get(MonitorizacaoService);
  });

  describe('registarDispositivo()', () => {
    it('rejeita quando o responsável não existe', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue(null);
      await expect(service.registarDispositivo({ nome: 'M1', responsavelId: 'x' } as any)).rejects.toBeInstanceOf(BadRequestException);
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
    it('chave em falta → 401', async () => {
      await expect(service.ingerir(undefined, {} as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('chave com segredo errado → 401', async () => {
      const hash = await bcrypt.hash('segredo-certo', 10);
      mockPrisma.dispositivoMonitor.findUnique.mockResolvedValue({ id: 'disp-1', ativo: true, apiKeyHash: hash, doenteId: 'd1', responsavelId: 'u1' });
      await expect(service.ingerir('disp-1.segredo-errado', {} as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('chave válida → ingere pela pipeline de sinais vitais e devolve NEWS2', async () => {
      const secret = 'segredo-certo';
      const hash = await bcrypt.hash(secret, 10);
      mockPrisma.dispositivoMonitor.findUnique.mockResolvedValue({ id: 'disp-1', ativo: true, apiKeyHash: hash, doenteId: 'd1', responsavelId: 'u1' });
      mockPrisma.dispositivoMonitor.update.mockResolvedValue({});
      mockSinais.ingerirDeMonitor.mockResolvedValue({ id: 'sv-1', news2: 8 });

      const r = await service.ingerir(`disp-1.${secret}`, { pulso: 130, saturacaoO2: 84 } as any);
      expect(r).toEqual({ ok: true, sinalVitalId: 'sv-1', news2: 8 });
      expect(mockSinais.ingerirDeMonitor).toHaveBeenCalledWith('d1', 'u1', expect.objectContaining({ pulso: 130 }));
    });
  });

  describe('revogarDispositivo()', () => {
    it('lança NotFoundException quando não existe', async () => {
      mockPrisma.dispositivoMonitor.findUnique.mockResolvedValue(null);
      await expect(service.revogarDispositivo('x')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
