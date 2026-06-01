import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as otplib from 'otplib';
import { NotasClinicasService } from './notas-clinicas.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  doente: {
    findUnique: jest.fn(),
  },
  notaClinica: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  utilizador: {
    findUnique: jest.fn(),
  },
};

describe('NotasClinicasService', () => {
  let service: NotasClinicasService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotasClinicasService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotasClinicasService>(NotasClinicasService);
  });

  // ── criar() ──────────────────────────────────────────────────────────────────

  describe('criar()', () => {
    it('lança NotFoundException quando doente não existe', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue(null);

      await expect(
        service.criar('doente-inexistente', { subjetivo: 'S', objetivo: 'O', avaliacao: 'A', plano: 'P' }, 'autor-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('cria nota clínica com o autorId correto', async () => {
      mockPrisma.doente.findUnique.mockResolvedValue({ id: 'doente-1' });
      const notaCriada = {
        id: 'nota-1',
        doenteId: 'doente-1',
        autorId: 'autor-1',
        subjetivo: 'Doente refere dor',
        objetivo: 'TA normal',
        avaliacao: 'Estável',
        plano: 'Monitorizar',
        autor: { id: 'autor-1', nome: 'Dr. Ana', role: 'medico', subRole: null },
      };
      mockPrisma.notaClinica.create.mockResolvedValue(notaCriada);

      const dto = { subjetivo: 'Doente refere dor', objetivo: 'TA normal', avaliacao: 'Estável', plano: 'Monitorizar' };
      const resultado = await service.criar('doente-1', dto, 'autor-1');

      expect(mockPrisma.notaClinica.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ doenteId: 'doente-1', autorId: 'autor-1' }),
        }),
      );
      expect(resultado).toEqual(notaCriada);
    });
  });

  // ── atualizar() ──────────────────────────────────────────────────────────────

  describe('atualizar()', () => {
    it('lança NotFoundException quando nota não existe', async () => {
      mockPrisma.notaClinica.findUnique.mockResolvedValue(null);

      await expect(
        service.atualizar('nota-inexistente', 'user-1', 'medico', { subjetivo: 'novo' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('o autor pode editar a sua própria nota', async () => {
      mockPrisma.notaClinica.findUnique.mockResolvedValue({ id: 'nota-1', autorId: 'autor-1' });
      mockPrisma.notaClinica.update.mockResolvedValue({ id: 'nota-1', subjetivo: 'atualizado' });

      await expect(
        service.atualizar('nota-1', 'autor-1', 'enfermeiro', { subjetivo: 'atualizado' }),
      ).resolves.not.toThrow();

      expect(mockPrisma.notaClinica.update).toHaveBeenCalled();
    });

    it('lança ForbiddenException quando não é autor e não tem role de supervisão', async () => {
      mockPrisma.notaClinica.findUnique.mockResolvedValue({ id: 'nota-1', autorId: 'autor-diferente' });

      await expect(
        service.atualizar('nota-1', 'outro-user', 'enfermeiro', { subjetivo: 'novo' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('utilizador com role "direcao" pode editar nota de outro autor', async () => {
      mockPrisma.notaClinica.findUnique.mockResolvedValue({ id: 'nota-1', autorId: 'autor-diferente' });
      mockPrisma.notaClinica.update.mockResolvedValue({ id: 'nota-1', subjetivo: 'editado por direcao' });

      await expect(
        service.atualizar('nota-1', 'diretor-1', 'direcao', { subjetivo: 'editado por direcao' }),
      ).resolves.not.toThrow();

      expect(mockPrisma.notaClinica.update).toHaveBeenCalled();
    });

    it('utilizador com role "chefe_medicos" pode editar nota de outro autor', async () => {
      mockPrisma.notaClinica.findUnique.mockResolvedValue({ id: 'nota-1', autorId: 'autor-diferente' });
      mockPrisma.notaClinica.update.mockResolvedValue({ id: 'nota-1', subjetivo: 'editado' });

      await expect(
        service.atualizar('nota-1', 'chefe-1', 'chefe_medicos', { subjetivo: 'editado' }),
      ).resolves.not.toThrow();
    });
  });

  // ── apagar() ─────────────────────────────────────────────────────────────────

  describe('apagar()', () => {
    it('lança ForbiddenException quando não é autor e não tem role de supervisão', async () => {
      mockPrisma.notaClinica.findUnique.mockResolvedValue({ id: 'nota-1', autorId: 'autor-diferente' });

      await expect(
        service.apagar('nota-1', 'outro-user', 'enfermeiro'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('o autor pode apagar a sua nota (chama prisma.notaClinica.delete)', async () => {
      mockPrisma.notaClinica.findUnique.mockResolvedValue({ id: 'nota-1', autorId: 'autor-1' });
      mockPrisma.notaClinica.delete.mockResolvedValue({ id: 'nota-1' });

      await service.apagar('nota-1', 'autor-1', 'medico');

      expect(mockPrisma.notaClinica.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'nota-1' } }),
      );
    });
  });

  // ── assinar() ────────────────────────────────────────────────────────────────

  describe('assinar()', () => {
    it('lança NotFoundException quando utilizador não existe', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue(null);

      await expect(
        service.assinar('nota-1', 'user-inexistente', '123456'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando MFA não está configurado', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: 'user-1', mfaAtivo: false, mfaSecret: null,
      });

      await expect(
        service.assinar('nota-1', 'user-1', '123456'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança ForbiddenException quando código TOTP é inválido', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: 'user-1', mfaAtivo: true, mfaSecret: 'SECRET123',
      });
      // Garantir que o authenticator retorna false
      jest.spyOn(otplib.authenticator, 'verify').mockReturnValue(false);

      await expect(
        service.assinar('nota-1', 'user-1', '000000'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança BadRequestException quando nota já foi assinada', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: 'user-1', mfaAtivo: true, mfaSecret: 'SECRET123',
      });
      jest.spyOn(otplib.authenticator, 'verify').mockReturnValue(true);
      mockPrisma.notaClinica.findUnique.mockResolvedValue({
        id: 'nota-1', assinadaEm: new Date(),
      });

      await expect(
        service.assinar('nota-1', 'user-1', '123456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('assina nota com sucesso quando TOTP é válido e nota ainda não assinada', async () => {
      mockPrisma.utilizador.findUnique.mockResolvedValue({
        id: 'user-1', mfaAtivo: true, mfaSecret: 'SECRET123',
      });
      jest.spyOn(otplib.authenticator, 'verify').mockReturnValue(true);
      mockPrisma.notaClinica.findUnique.mockResolvedValue({
        id: 'nota-1', assinadaEm: null,
      });
      mockPrisma.notaClinica.update.mockResolvedValue({
        id: 'nota-1',
        assinadaEm: new Date(),
        assinadaPor: { id: 'user-1', nome: 'Dr. Ana' },
      });

      const resultado = await service.assinar('nota-1', 'user-1', '123456');

      expect(mockPrisma.notaClinica.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'nota-1' },
          data: expect.objectContaining({ assinadaPorId: 'user-1' }),
        }),
      );
      expect(resultado).toHaveProperty('assinadaEm');
    });
  });
});
