import { BadRequestException, ConflictException } from '@nestjs/common';
import { nifValido } from '@org/shared';
import { RegistoUtenteService } from './registo-utente.service';

function montar() {
  const tx: any = {
    ficheiroPessoalDoente: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    doente: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(2), create: jest.fn(async ({ data }) => ({ id: 'd1', ...data })) },
  };
  const prisma: any = { $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)), doente: { findMany: jest.fn().mockResolvedValue([]) } };
  return { tx, prisma, service: new RegistoUtenteService(prisma) };
}

describe('RegistoUtenteService (UX-23)', () => {
  it('NIF com dígito de controlo: "999999999" deixa de passar', () => {
    expect(nifValido('123456789')).toBe(true);
    expect(nifValido('999999999')).toBe(false);
    expect(nifValido('123456780')).toBe(false);
    expect(nifValido('12345678')).toBe(false);
  });

  it('só o nome e a data são obrigatórios — sem NIF, SNS nem telefone', async () => {
    const { tx, service } = montar();
    await service.registroRapido({ nome: 'John Smith', dataNascimento: '1970-01-01' } as any, 'adm');
    expect(tx.doente.create).toHaveBeenCalled();
    expect(tx.ficheiroPessoalDoente.create).not.toHaveBeenCalled();
  });

  it('NIF inválido é recusado', async () => {
    const { service } = montar();
    await expect(service.registroRapido({ nome: 'A', dataNascimento: '1970-01-01', nif: '999999999' } as any, 'adm')).rejects.toThrow(BadRequestException);
  });

  it('utente não identificado: nome provisório numerado no dia, sem mais nada obrigatório', async () => {
    const { tx, service } = montar();
    const d: any = await service.registroRapido({ provisorio: true, tipoVisita: 'urgencia' } as any, 'adm');
    expect(d.nome).toMatch(/^Desconhecido \d{4}-\d{2}-\d{2} #3$/);
    expect(tx.doente.create.mock.calls[0][0].data.identificacaoProvisoria).toBe(true);
  });

  it('NIF já registado: recusa e diz qual é o processo', async () => {
    const { tx, service } = montar();
    tx.ficheiroPessoalDoente.findFirst.mockResolvedValueOnce({ doente: { numeroProcesso: '2026-00000007' } });
    await expect(service.registroRapido({ nome: 'A', dataNascimento: '1970-01-01', nif: '123456789' } as any, 'adm'))
      .rejects.toThrow(new ConflictException('Já existe um utente com o NIF 123456789 (processo 2026-00000007)'));
  });

  it('possíveis duplicados: ignora NIF inválido e nome sem data', async () => {
    const { prisma, service } = montar();
    await service.possiveisDuplicados({ nif: '999999999', nome: 'Maria' });
    expect(prisma.doente.findMany).not.toHaveBeenCalled();
    await service.possiveisDuplicados({ nif: '123456789' });
    expect(prisma.doente.findMany).toHaveBeenCalledTimes(1);
  });
});
