// FhirService pode ter dependências externas — mockar o módulo
jest.mock('../fhir/fhir.service', () => ({
  FhirService: jest.fn().mockImplementation(() => ({
    sincronizarDocumentos: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DocumentosSaudeService } from './documentos-saude.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage.service';
import { FhirService } from '../fhir/fhir.service';
import { AuditService } from '../common/audit.service';

const mockPrisma = {
  doente: { findUnique: jest.fn() },
  documentoSaude: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockStorage = {
  upload: jest.fn().mockResolvedValue('docs/doente-1/doc.pdf'),
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.url/doc.pdf'),
  delete: jest.fn().mockResolvedValue(undefined),
};

const mockFhir = { sincronizarDocumentos: jest.fn().mockResolvedValue(undefined) };

const docBase = {
  id: 'doc-1', doenteId: 'd1', titulo: 'RX Tórax', tipo: 'imagem',
  formato: 'pdf', storageKey: 'docs/d1/rx.pdf', tamanhoBytes: 1024,
};

describe('DocumentosSaudeService', () => {
  let service: DocumentosSaudeService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStorage.upload.mockResolvedValue('docs/d1/doc.pdf');
    mockStorage.getSignedUrl.mockResolvedValue('https://signed.url/doc.pdf');
    mockFhir.sincronizarDocumentos.mockResolvedValue(undefined);
    mockPrisma.doente.findUnique.mockResolvedValue({ id: 'd1', nome: 'Ana' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentosSaudeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: FhirService, useValue: mockFhir },
        { provide: AuditService, useValue: { registar: jest.fn() } },
      ],
    }).compile();

    service = module.get<DocumentosSaudeService>(DocumentosSaudeService);
  });

  describe('listar()', () => {
    it('devolve documentos do doente', async () => {
      mockPrisma.documentoSaude.findMany.mockResolvedValue([docBase]);

      const resultado = await service.listar('d1');

      expect(resultado).toHaveLength(1);
    });

    it('filtra por tipo quando fornecido', async () => {
      mockPrisma.documentoSaude.findMany.mockResolvedValue([docBase]);

      await service.listar('d1', 'imagem');

      expect(mockPrisma.documentoSaude.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tipo: 'imagem' }) }),
      );
    });
  });

  describe('getDownloadUrl()', () => {
    it('lança NotFoundException quando documento não existe', async () => {
      mockPrisma.documentoSaude.findUnique.mockResolvedValue(null);

      await expect(service.getDownloadUrl('id-inexistente', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('devolve URL assinada para download', async () => {
      mockPrisma.documentoSaude.findUnique.mockResolvedValue(docBase);

      const resultado = await service.getDownloadUrl('doc-1', 'u1');

      expect(resultado.url).toContain('signed.url');
    });
  });

  describe('upload()', () => {
    it('faz upload e cria registo de documento', async () => {
      const mockFile = { buffer: Buffer.from('pdf'), originalname: 'rx.pdf', mimetype: 'application/pdf', size: 1024 } as any;
      mockPrisma.documentoSaude.create.mockResolvedValue(docBase);

      const resultado = await service.upload('d1', mockFile, { titulo: 'RX Tórax', tipo: 'imagem' } as any, 'u1');

      expect(mockStorage.upload).toHaveBeenCalled();
      expect(resultado.titulo).toBe('RX Tórax');
    });
  });
});
