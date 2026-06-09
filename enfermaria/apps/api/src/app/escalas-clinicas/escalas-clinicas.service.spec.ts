import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EscalasClinicasService } from './escalas-clinicas.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: {
    findUnique: jest.fn(),
  },
  escalaClinica: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
};

describe('EscalasClinicasService', () => {
  let service: EscalasClinicasService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalasClinicasService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EscalasClinicasService>(EscalasClinicasService);
  });

  // ── registar() ───────────────────────────────────────────────────────────────

  describe('registar()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(
        service.registar('doente-inexistente', { tipo: 'RASS', valores: { nivel: -1 } }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('cria registo de escala clínica com dados correctos', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1' });
      const registoCriado = {
        id: 'ec-1',
        doenteId: 'doente-1',
        registadoPorId: 'user-1',
        tipo: 'RASS',
        valores: { nivel: -2 },
        pontuacao: -2,
        classificacao: 'Sedação ligeira',
        registadoPor: { id: 'user-1', nome: 'Enf. Maria', role: 'enfermeiro', subRole: null },
      };
      mockPrisma.escalaClinica.create.mockResolvedValue(registoCriado);

      const dto = {
        tipo: 'RASS',
        valores: { nivel: -2 },
        pontuacao: -2,
        classificacao: 'Sedação ligeira',
      };

      const resultado = await service.registar('doente-1', dto, 'user-1');

      expect(mockPrisma.escalaClinica.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            doenteId: 'doente-1',
            registadoPorId: 'user-1',
            tipo: 'RASS',
            valores: { nivel: -2 },
          }),
        }),
      );
      expect(resultado).toEqual(registoCriado);
    });
  });

  // ── listar() ─────────────────────────────────────────────────────────────────

  describe('listar()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(service.listar('doente-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('devolve todos os registos quando tipo não é fornecido', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1' });
      const registos = [
        { id: 'ec-1', tipo: 'RASS', doenteId: 'doente-1' },
        { id: 'ec-2', tipo: 'SOFA', doenteId: 'doente-1' },
      ];
      mockPrisma.escalaClinica.findMany.mockResolvedValue(registos);

      const resultado = await service.listar('doente-1');

      expect(mockPrisma.escalaClinica.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ doenteId: 'doente-1' }),
        }),
      );
      const chamada = mockPrisma.escalaClinica.findMany.mock.calls[0][0];
      expect(chamada.where).not.toHaveProperty('tipo');
      expect(resultado).toHaveLength(2);
    });

    it('filtra por tipo quando tipo é fornecido', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1' });
      const registos = [{ id: 'ec-1', tipo: 'RASS', doenteId: 'doente-1' }];
      mockPrisma.escalaClinica.findMany.mockResolvedValue(registos);

      await service.listar('doente-1', 'RASS');

      expect(mockPrisma.escalaClinica.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ doenteId: 'doente-1', tipo: 'RASS' }),
        }),
      );
    });
  });

  // ── listarRecentes() ─────────────────────────────────────────────────────────

  describe('listarRecentes()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(service.listarRecentes('doente-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('devolve o registo mais recente por tipo (filtra nulos)', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1' });

      // Simula: RASS existe, CPOT e os restantes são null
      mockPrisma.escalaClinica.findFirst
        .mockResolvedValueOnce({ id: 'ec-1', tipo: 'RASS', doenteId: 'doente-1' })  // RASS
        .mockResolvedValueOnce(null)   // CPOT
        .mockResolvedValueOnce(null)   // SOFA
        .mockResolvedValueOnce(null)   // CTG
        .mockResolvedValueOnce(null)   // Apgar
        .mockResolvedValueOnce(null)   // PEWS
        .mockResolvedValueOnce(null);  // FLACC

      const resultado = await service.listarRecentes('doente-1');

      // Apenas o registo RASS existe — os null são filtrados
      expect(resultado).toHaveLength(1);
      expect(resultado[0]).toHaveProperty('tipo', 'RASS');
    });

    it('consulta os 7 tipos de escala predefinidos', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1' });
      mockPrisma.escalaClinica.findFirst.mockResolvedValue(null);

      await service.listarRecentes('doente-1');

      // Deve ter sido chamado 8 vezes (RASS, CPOT, SOFA, CTG, Apgar, PEWS, FLACC, Glasgow)
      expect(mockPrisma.escalaClinica.findFirst).toHaveBeenCalledTimes(8);
    });
  });
});
