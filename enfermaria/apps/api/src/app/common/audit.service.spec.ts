import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  auditLog: { create: jest.fn().mockResolvedValue({ id: 'al-1' }) },
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<AuditService>(AuditService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('registar()', () => {
    it('regista entrada de auditoria (fire-and-forget)', () => {
      expect(() =>
        service.registar({ utilizadorId: 'u1', acao: 'login', entidadeTipo: 'auth', ip: '127.0.0.1' }),
      ).not.toThrow();
    });

    it('não propaga excepção quando prisma.auditLog.create rejeita', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB offline'));

      // registar() é void — não deve lançar mesmo quando prisma falha
      expect(() =>
        service.registar({ utilizadorId: 'u1', acao: 'login' }),
      ).not.toThrow();

      // Flush microtasks — a promise rejeitada deve ser absorvida silenciosamente
      await Promise.resolve();
      await Promise.resolve();
    });

    it('chama prisma.create sem entidadeId quando não fornecido', () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'al-2' });

      service.registar({ utilizadorId: 'u2', acao: 'logout' });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ entidadeId: expect.anything() }),
        }),
      );
    });
  });
});
