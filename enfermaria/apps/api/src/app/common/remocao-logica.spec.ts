// ARQ-04 — registos clínicos removidos com autor, momento e motivo; a linha (e o ficheiro)
// ficam no processo. Antes eram apagados fisicamente, sem rasto do conteúdo.
jest.mock('../fhir/fhir.service', () => ({ FhirService: jest.fn() }));

import { NotFoundException } from '@nestjs/common';
import { BalancoHidricoService } from '../balanco-hidrico/balanco-hidrico.service';
import { DocumentosSaudeService } from '../documentos-saude/documentos-saude.service';
import { FeridasService } from '../feridas/feridas.service';

const data = { deletedAt: expect.any(Date), removidoPorId: 'u-1', motivoRemocao: 'registado no doente errado' };

describe('remoção lógica de registos clínicos (ARQ-04)', () => {
  it('balanço hídrico: update com motivo, nunca delete', async () => {
    const prisma = { balancoHidrico: { findUnique: jest.fn().mockResolvedValue({ id: 'b1', registadoPorId: 'u-1' }), update: jest.fn().mockResolvedValue({}), delete: jest.fn() } };
    const s = new BalancoHidricoService(prisma as never);
    await s.apagar('b1', 'u-1', 'enfermeiro', 'registado no doente errado');
    expect(prisma.balancoHidrico.delete).not.toHaveBeenCalled();
    expect(prisma.balancoHidrico.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data });
  });

  it('balanço hídrico já removido é 404', async () => {
    const prisma = { balancoHidrico: { findUnique: jest.fn().mockResolvedValue({ id: 'b1', registadoPorId: 'u-1', deletedAt: new Date() }), update: jest.fn() } };
    await expect(new BalancoHidricoService(prisma as never).apagar('b1', 'u-1', 'enfermeiro', 'x'.repeat(12))).rejects.toThrow(NotFoundException);
  });

  it('documento de saúde: o ficheiro fica no armazenamento', async () => {
    const prisma = { documentoSaude: { findUnique: jest.fn().mockResolvedValue({ id: 'd1', storageKey: 'k' }), update: jest.fn().mockResolvedValue({}), delete: jest.fn() } };
    const storage = { delete: jest.fn() };
    const s = new DocumentosSaudeService(prisma as never, storage as never, {} as never, {} as never);
    await s.remover('d1', 'u-1', 'medico', 'registado no doente errado');
    expect(storage.delete).not.toHaveBeenCalled();
    expect(prisma.documentoSaude.delete).not.toHaveBeenCalled();
    expect(prisma.documentoSaude.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data });
  });

  it('fotografia de ferida: o ficheiro fica no armazenamento', async () => {
    const prisma = { fotoFerida: { findUnique: jest.fn().mockResolvedValue({ id: 'f1', criadaPorId: 'u-1', storageKey: 'k' }), update: jest.fn().mockResolvedValue({}), delete: jest.fn() } };
    const storage = { delete: jest.fn() };
    const s = new FeridasService(prisma as never, storage as never);
    await s.removerFoto('f1', 'u-1', 'enfermeiro', 'registado no doente errado');
    expect(storage.delete).not.toHaveBeenCalled();
    expect(prisma.fotoFerida.update).toHaveBeenCalledWith({ where: { id: 'f1' }, data });
  });
});
