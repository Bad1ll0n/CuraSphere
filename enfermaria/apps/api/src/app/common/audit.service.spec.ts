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
  });
});
