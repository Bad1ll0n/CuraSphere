import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SinalizacoesService } from './sinalizacoes.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { EventsGateway } from '../gateway/events.gateway';

const mockEmit = jest.fn();
const mockPrisma = {
  doente: { findUnique: jest.fn() },
  sinalizacaoPreocupante: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
};
const mockAlertas = { criarAlerta: jest.fn().mockResolvedValue(undefined) };
const mockGateway = { server: { to: jest.fn().mockReturnValue({ emit: mockEmit }) } };

const sinalizacaoBase = {
  id: 'sn-1', doenteId: 'd1', motivo: 'Deterioração clínica', nivelUrgencia: 'normal', resolvida: false,
  criadaPor: { id: 'enf-1', nome: 'Ana', role: 'enfermeiro' },
};

describe('SinalizacoesService', () => {
  let service: SinalizacoesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', nome: 'João' });
    mockPrisma.sinalizacaoPreocupante.findFirst.mockResolvedValue(null);
    mockGateway.server.to.mockReturnValue({ emit: mockEmit });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SinalizacoesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AlertasService, useValue: mockAlertas },
        { provide: EventsGateway, useValue: mockGateway },
      ],
    }).compile();
    service = module.get<SinalizacoesService>(SinalizacoesService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('criar()', () => {
    it('cria sinalização', async () => {
      mockPrisma.sinalizacaoPreocupante.create.mockResolvedValue(sinalizacaoBase);
      const r = await service.criar('d1', { motivo: 'Deterioração clínica', nivelUrgencia: 'normal' } as any, 'enf-1');
      expect(r.motivo).toBe('Deterioração clínica');
    });

    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);
      await expect(service.criar('x', { motivo: 'test' } as any, 'u1')).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException quando já existe sinalização ativa', async () => {
      mockPrisma.sinalizacaoPreocupante.findFirst.mockResolvedValue(sinalizacaoBase);
      await expect(service.criar('d1', { motivo: 'test' } as any, 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolver()', () => {
    it('resolve sinalização', async () => {
      mockPrisma.sinalizacaoPreocupante.findUnique.mockResolvedValue(sinalizacaoBase);
      mockPrisma.sinalizacaoPreocupante.update.mockResolvedValue({ ...sinalizacaoBase, resolvida: true });
      const r = await service.resolver('sn-1', 'med-1');
      expect(r.resolvida).toBe(true);
    });

    it('lança NotFoundException quando sinalização não existe', async () => {
      mockPrisma.sinalizacaoPreocupante.findUnique.mockResolvedValue(null);
      await expect(service.resolver('x', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listarAtivas()', () => {
    it('devolve sinalizações activas', async () => {
      mockPrisma.sinalizacaoPreocupante.findMany.mockResolvedValue([sinalizacaoBase]);
      const r = await service.listarAtivas('d1');
      expect(r).toHaveLength(1);
    });
  });
});
