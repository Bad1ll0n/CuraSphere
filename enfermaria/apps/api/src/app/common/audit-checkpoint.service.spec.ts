import { Test, TestingModule } from '@nestjs/testing';
import { createHash, createHmac } from 'crypto';
import { AuditCheckpointService } from './audit-checkpoint.service';
import { PrismaService } from '../prisma/prisma.service';

const KEY = process.env['AUDIT_SIGNING_KEY'] ?? 'dev-insecure-audit-signing-key-change-me';
const raizDe = (hashes: string[], prev = '') => hashes.reduce((h, c) => createHash('sha256').update(h + '|' + c).digest('hex'), prev);
const assinar = (raiz: string) => createHmac('sha256', KEY).update(raiz).digest('hex');

const tx = {
  $queryRawUnsafe: jest.fn(),
  auditCheckpoint: { findFirst: jest.fn(), create: jest.fn().mockResolvedValue({}) },
};
const mockPrisma = {
  $transaction: jest.fn(async (cb: any) => cb(tx)),
  auditCheckpoint: { findMany: jest.fn() },
  $queryRawUnsafe: jest.fn(),
};

describe('AuditCheckpointService', () => {
  let service: AuditCheckpointService;

  beforeEach(async () => {
    jest.clearAllMocks();
    tx.auditCheckpoint.create.mockResolvedValue({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditCheckpointService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(AuditCheckpointService);
  });
  afterEach(() => service.onModuleDestroy());

  describe('selar()', () => {
    it('sela um checkpoint assinado sobre as linhas assentes', async () => {
      tx.$queryRawUnsafe
        .mockResolvedValueOnce([{ locked: true }])
        .mockResolvedValueOnce([{ seq: 1, contentHash: 'h1' }, { seq: 2, contentHash: 'h2' }]);
      tx.auditCheckpoint.findFirst.mockResolvedValue(null);

      const r = await service.selar();
      expect(r).toEqual({ selado: true, seqInicio: 1, seqFim: 2, total: 2 });
      const data = tx.auditCheckpoint.create.mock.calls[0][0].data;
      expect(data.raiz).toBe(raizDe(['h1', 'h2']));
      expect(data.assinatura).toBe(assinar(data.raiz)); // raiz assinada
    });

    it('não sela quando não é o líder (lock não adquirido)', async () => {
      tx.$queryRawUnsafe.mockResolvedValueOnce([{ locked: false }]);
      expect(await service.selar()).toEqual({ selado: false });
      expect(tx.auditCheckpoint.create).not.toHaveBeenCalled();
    });

    it('não sela quando não há linhas novas assentes', async () => {
      tx.$queryRawUnsafe.mockResolvedValueOnce([{ locked: true }]).mockResolvedValueOnce([]);
      tx.auditCheckpoint.findFirst.mockResolvedValue(null);
      expect(await service.selar()).toEqual({ selado: false });
    });
  });

  describe('verificar()', () => {
    it('cadeia íntegra → ok', async () => {
      const raiz = raizDe(['a', 'b']);
      mockPrisma.auditCheckpoint.findMany.mockResolvedValue([
        { seqInicio: 1, seqFim: 2, raiz, prevCheckpointHash: null, assinatura: assinar(raiz) },
      ]);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ contentHash: 'a' }, { contentHash: 'b' }]);
      const r = await service.verificar();
      expect(r.ok).toBe(true);
      expect(r.checkpoints).toBe(1);
    });

    it('deteta adulteração de uma linha selada (raiz recalculada não bate)', async () => {
      const raiz = raizDe(['a', 'b']);
      mockPrisma.auditCheckpoint.findMany.mockResolvedValue([
        { seqInicio: 1, seqFim: 2, raiz, prevCheckpointHash: null, assinatura: assinar(raiz) },
      ]);
      // conteúdo devolvido difere do que foi selado → adulteração
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ contentHash: 'a' }, { contentHash: 'ADULTERADO' }]);
      const r = await service.verificar();
      expect(r.ok).toBe(false);
      expect(r.primeiraFalha?.motivo).toMatch(/não bate/i);
    });

    it('deteta checkpoint forjado (assinatura inválida)', async () => {
      const raiz = raizDe(['a']);
      mockPrisma.auditCheckpoint.findMany.mockResolvedValue([
        { seqInicio: 1, seqFim: 1, raiz, prevCheckpointHash: null, assinatura: 'assinatura-falsa' },
      ]);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ contentHash: 'a' }]);
      const r = await service.verificar();
      expect(r.ok).toBe(false);
      expect(r.primeiraFalha?.motivo).toMatch(/assinatura/i);
    });
  });
});
