import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

// tx usado dentro de $transaction — advisory lock + leitura da última entrada + insert.
const tx = {
  $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
  auditLog: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'al-1' }),
  },
};
const mockPrisma = {
  $transaction: jest.fn(async (cb: any) => cb(tx)),
  auditLog: { findMany: jest.fn().mockResolvedValue([]) },
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    jest.clearAllMocks();
    tx.auditLog.findFirst.mockResolvedValue(null);
    tx.auditLog.create.mockResolvedValue({ id: 'al-1' });
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<AuditService>(AuditService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('registar() — escrita encadeada', () => {
    it('é fire-and-forget (não lança) e insere com prevHash+hash', async () => {
      expect(() =>
        service.registar({ utilizadorId: 'u1', acao: 'login', entidadeTipo: 'auth', ip: '127.0.0.1' }),
      ).not.toThrow();
      await new Promise((r) => setTimeout(r, 0)); // flush do fire-and-forget

      expect(tx.$executeRawUnsafe).toHaveBeenCalled(); // advisory lock
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            utilizadorId: 'u1',
            acao: 'login',
            prevHash: null,
            hash: expect.any(String),
          }),
        }),
      );
    });

    it('não propaga excepção quando a transação falha', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('DB offline'));
      expect(() => service.registar({ utilizadorId: 'u1', acao: 'login' })).not.toThrow();
      await new Promise((r) => setTimeout(r, 0));
    });

    it('encadeia: prevHash da nova entrada = hash da anterior', async () => {
      tx.auditLog.findFirst.mockResolvedValue({ hash: 'HASH_ANTERIOR' });
      service.registar({ utilizadorId: 'u2', acao: 'logout' });
      await new Promise((r) => setTimeout(r, 0));

      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ prevHash: 'HASH_ANTERIOR' }) }),
      );
    });
  });

  describe('verificarIntegridade()', () => {
    it('cadeia vazia → íntegra', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      const r = await service.verificarIntegridade();
      expect(r.ok).toBe(true);
      expect(r.totalVerificadas).toBe(0);
    });

    it('deteta adulteração quando o hash não corresponde ao conteúdo', async () => {
      mockPrisma.auditLog.findMany
        .mockResolvedValueOnce([
          { seq: 1, utilizadorId: 'u1', acao: 'login', entidadeId: null, entidadeTipo: null, detalhes: null, ip: null, userAgent: null, createdAt: new Date('2020-01-01T00:00:00.000Z'), prevHash: null, hash: 'HASH_FALSIFICADO' },
        ])
        .mockResolvedValueOnce([]);
      const r = await service.verificarIntegridade();
      expect(r.ok).toBe(false);
      expect(r.primeiraQuebra?.seq).toBe(1);
    });
  });
});
