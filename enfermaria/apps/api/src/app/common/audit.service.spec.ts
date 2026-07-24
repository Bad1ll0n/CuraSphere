import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

// tx usado dentro de $transaction — advisory lock + leitura da última entrada + createMany do lote.
const tx = {
  $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
  auditLog: {
    findFirst: jest.fn().mockResolvedValue(null),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
};
const mockPrisma = {
  $transaction: jest.fn(async (cb: any) => cb(tx)),
  auditLog: { findMany: jest.fn().mockResolvedValue([]) },
};

describe('AuditService (fila + escrita em lote)', () => {
  let service: AuditService;

  beforeEach(async () => {
    jest.clearAllMocks();
    tx.auditLog.findFirst.mockResolvedValue(null);
    tx.auditLog.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(AuditService);
  });

  afterEach(async () => {
    // Limpa o timer do worker (evita handles abertos no jest).
    await service.onModuleDestroy();
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('registar() + flush()', () => {
    it('registar é não-bloqueante (não lança) e não escreve de imediato', () => {
      expect(() => service.registar({ utilizadorId: 'u1', acao: 'login', ip: '127.0.0.1' })).not.toThrow();
      expect(tx.auditLog.createMany).not.toHaveBeenCalled(); // só a fila; escrita é diferida
    });

    it('flush escreve o lote em createMany, encadeando prevHash+hash', async () => {
      service.registar({ utilizadorId: 'u1', acao: 'login' });
      service.registar({ utilizadorId: 'u2', acao: 'logout' });
      await (service as any).flush();

      expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(1); // 1 advisory lock por lote
      expect(tx.auditLog.createMany).toHaveBeenCalledTimes(1);
      const data = tx.auditLog.createMany.mock.calls[0][0].data;
      expect(data).toHaveLength(2);
      expect(data[0].prevHash).toBeNull();
      expect(data[0].hash).toEqual(expect.any(String));
      expect(data[1].prevHash).toBe(data[0].hash); // 2.ª entrada encadeia na 1.ª
    });

    it('continua a cadeia a partir do hash da última entrada em BD', async () => {
      tx.auditLog.findFirst.mockResolvedValue({ hash: 'HASH_ANTERIOR' });
      service.registar({ utilizadorId: 'u2', acao: 'logout' });
      await (service as any).flush();
      const data = tx.auditLog.createMany.mock.calls[0][0].data;
      expect(data[0].prevHash).toBe('HASH_ANTERIOR');
    });

    it('em falha da transação, repõe o lote na fila (não perde entradas)', async () => {
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('BD offline'));
      service.registar({ utilizadorId: 'u1', acao: 'x' });
      await (service as any).flush();
      // lote reposto → nova tentativa escreve-o
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
      await (service as any).flush();
      expect(tx.auditLog.createMany).toHaveBeenCalledTimes(1);
      expect(tx.auditLog.createMany.mock.calls[0][0].data).toHaveLength(1);
    });

    it('ao atingir o tamanho do lote dispara escrita imediata (sem esperar pelo intervalo)', async () => {
      for (let i = 0; i < 500; i++) service.registar({ utilizadorId: 'u', acao: 'a' });
      await new Promise((r) => setImmediate(r)); // deixa o flush disparado correr
      expect(tx.auditLog.createMany).toHaveBeenCalled();
    });

    it('drenar (callback do worker) despoleta o flush da fila', async () => {
      service.registar({ utilizadorId: 'u', acao: 'a' });
      (service as any).drenar();
      await new Promise((r) => setImmediate(r));
      expect(tx.auditLog.createMany).toHaveBeenCalled();
    });

    it('descarta (com contador) quando a fila em memória atinge o teto de segurança', () => {
      (service as any).fila = Array.from({ length: 50_000 }, () => ({ utilizadorId: 'x', acao: 'y', createdAt: new Date() }));
      service.registar({ utilizadorId: 'novo', acao: 'perdido' });
      expect((service as any).fila.length).toBe(50_000); // não cresceu
      expect((service as any).descartadas).toBe(1);
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
