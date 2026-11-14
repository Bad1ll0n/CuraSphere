jest.mock('otplib', () => ({ verify: jest.fn() }));

import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CartaAltaService } from './carta-alta.service';
import { PrismaService } from '../prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { verify: verifyTotp } = require('otplib') as { verify: jest.Mock };

// PROD-11: rascunho da IA → revista → assinada (TOTP). Só a assinada sai em PDF.
describe('CartaAltaService', () => {
  const prisma = {
    sumarioAlta: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    utilizador: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
  const service = new CartaAltaService(prisma as unknown as PrismaService);
  const medico = { mfaAtivo: true, mfaSecret: 'SEGREDO' };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.utilizador.findUnique.mockResolvedValue(medico);
    verifyTotp.mockResolvedValue({ valid: true });
  });

  describe('rever()', () => {
    it('guarda o texto do médico e marca a carta como revista', async () => {
      prisma.sumarioAlta.findFirst.mockResolvedValue({ id: 's1', cartaAlta: 'rascunho', cartaAltaEstado: 'rascunho' });
      await service.rever('d1', 'med-1', 'Texto revisto');
      expect(prisma.sumarioAlta.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 's1' },
        data: expect.objectContaining({ cartaAlta: 'Texto revisto', cartaAltaEstado: 'revista', cartaAltaRevistaPorId: 'med-1' }),
      }));
    });

    it('não altera uma carta já assinada', async () => {
      prisma.sumarioAlta.findFirst.mockResolvedValue({ id: 's1', cartaAlta: 'x', cartaAltaEstado: 'assinada' });
      await expect(service.rever('d1', 'med-1', 'outro')).rejects.toThrow(ConflictException);
      expect(prisma.sumarioAlta.update).not.toHaveBeenCalled();
    });

    it('404 sem sumário de alta', async () => {
      prisma.sumarioAlta.findFirst.mockResolvedValue(null);
      await expect(service.rever('d1', 'med-1', 'x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assinar()', () => {
    it('não assina um rascunho que ninguém reviu', async () => {
      prisma.sumarioAlta.findFirst.mockResolvedValue({ id: 's1', cartaAlta: 'texto IA', cartaAltaEstado: 'rascunho' });
      await expect(service.assinar('d1', 'med-1', '123456')).rejects.toThrow(BadRequestException);
      expect(verifyTotp).not.toHaveBeenCalled();
    });

    it('exige um código TOTP válido', async () => {
      prisma.sumarioAlta.findFirst.mockResolvedValue({ id: 's1', cartaAlta: 'texto', cartaAltaEstado: 'revista' });
      verifyTotp.mockResolvedValue({ valid: false });
      await expect(service.assinar('d1', 'med-1', '000000')).rejects.toThrow(ForbiddenException);
      expect(prisma.sumarioAlta.updateMany).not.toHaveBeenCalled();
    });

    it('exige MFA configurado', async () => {
      prisma.sumarioAlta.findFirst.mockResolvedValue({ id: 's1', cartaAlta: 'texto', cartaAltaEstado: 'revista' });
      prisma.utilizador.findUnique.mockResolvedValue({ mfaAtivo: false, mfaSecret: null });
      await expect(service.assinar('d1', 'med-1', '123456')).rejects.toThrow(/MFA não configurado/);
    });

    it('assina uma carta revista, condicional ao estado', async () => {
      prisma.sumarioAlta.findFirst.mockResolvedValueOnce({ id: 's1', cartaAlta: 'texto', cartaAltaEstado: 'revista' });
      prisma.sumarioAlta.findUnique.mockResolvedValueOnce({ cartaAltaEstado: 'assinada' });
      prisma.sumarioAlta.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.assinar('d1', 'med-1', '123456')).resolves.toMatchObject({ cartaAltaEstado: 'assinada' });
      expect(prisma.sumarioAlta.updateMany).toHaveBeenCalledWith({
        where: { id: 's1', cartaAltaEstado: 'revista' },
        data: expect.objectContaining({ cartaAltaEstado: 'assinada', cartaAltaAssinadaPorId: 'med-1' }),
      });
    });

    it('recusa reutilizar o código TOTP', async () => {
      prisma.sumarioAlta.findFirst.mockResolvedValue({ id: 's1', cartaAlta: 'texto', cartaAltaEstado: 'revista' });
      prisma.$queryRaw.mockResolvedValue([{ existe: 1 }]);
      await expect(service.assinar('d1', 'med-1', '123456')).rejects.toThrow(/já utilizado/);
    });

    it('não assina duas vezes', async () => {
      prisma.sumarioAlta.findFirst.mockResolvedValue({ id: 's1', cartaAlta: 'texto', cartaAltaEstado: 'assinada' });
      await expect(service.assinar('d1', 'med-1', '123456')).rejects.toThrow(ConflictException);
    });
  });

  describe('garantirAssinada()', () => {
    it.each(['rascunho', 'revista', null])('bloqueia o PDF com a carta em %s', async (estado) => {
      prisma.sumarioAlta.findFirst.mockResolvedValue({ id: 's1', cartaAlta: 'x', cartaAltaEstado: estado });
      await expect(service.garantirAssinada('d1')).rejects.toThrow(ConflictException);
    });

    it('deixa passar a carta assinada', async () => {
      prisma.sumarioAlta.findFirst.mockResolvedValue({ id: 's1', cartaAlta: 'x', cartaAltaEstado: 'assinada' });
      await expect(service.garantirAssinada('d1')).resolves.toBeUndefined();
    });
  });
});
