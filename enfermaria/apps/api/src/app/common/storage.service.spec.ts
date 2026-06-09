import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'STORAGE_PROVIDER') return 'local';
    if (key === 'MINIO_BUCKET') return 'curasphere';
    return fallback ?? '';
  }),
};

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService, { provide: ConfigService, useValue: mockConfig }],
    }).compile();
    service = module.get<StorageService>(StorageService);
  });

  it('é definido', () => expect(service).toBeDefined());

  describe('upload()', () => {
    it('faz upload local e devolve key', async () => {
      const r = await service.upload(Buffer.from('test'), 'documentos/test.pdf', 'application/pdf');
      expect(r.key).toBe('documentos/test.pdf');
    });
  });
});
