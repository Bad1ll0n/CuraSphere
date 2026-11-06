import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConsentimentosTratamentoService } from './consentimentos-tratamento.service';
import { doentesComOposicaoIA, exigirTratamentoPermitido, tratamentoPermitido } from '../common/consentimento-tratamento';

/** Prisma em memória, só com o que o serviço usa. */
function prismaFalso() {
  const linhas: any[] = [];
  let seq = 0;
  const filtra = (w: any) => linhas.filter((l) =>
    (!w.doenteId || (typeof w.doenteId === 'string' ? l.doenteId === w.doenteId : w.doenteId.in.includes(l.doenteId))) &&
    (!w.finalidade || l.finalidade === w.finalidade) &&
    (w.revogadoEm !== null || l.revogadoEm === null));
  const recentes = (xs: any[]) => [...xs].sort((a, b) => b.registadoEm - a.registadoEm || b.seq - a.seq);
  const delegate = {
    findFirst: jest.fn(async ({ where }: any) => recentes(filtra(where))[0] ?? null),
    findMany: jest.fn(async ({ where }: any) => recentes(filtra(where))),
    updateMany: jest.fn(async ({ where, data }: any) => { const xs = filtra(where); xs.forEach((x) => Object.assign(x, data)); return { count: xs.length }; }),
    create: jest.fn(async ({ data }: any) => { const l = { id: `c${++seq}`, seq, registadoEm: new Date(), revogadoEm: null, ...data }; linhas.push(l); return l; }),
  };
  const prisma: any = {
    linhas,
    consentimentoTratamento: delegate,
    doente: { findUnique: jest.fn(async ({ where }: any) => (where.id === 'inexistente' ? null : { id: where.id })) },
    acessoFamiliar: { updateMany: jest.fn(async () => ({ count: 2 })) },
    portalDoente: { updateMany: jest.fn(async () => ({ count: 1 })) },
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  return prisma;
}

describe('SEC-19 — consentimento e oposição ao tratamento', () => {
  let prisma: any;
  let svc: ConsentimentosTratamentoService;
  beforeEach(() => { prisma = prismaFalso(); svc = new ConsentimentosTratamentoService(prisma); });

  it('sem registo: partilha e portal bloqueados, IA permitida', async () => {
    expect(await tratamentoPermitido(prisma, 'd1', 'partilha_familiares')).toBe(false);
    expect(await tratamentoPermitido(prisma, 'd1', 'portal_doente')).toBe(false);
    expect(await tratamentoPermitido(prisma, 'd1', 'ia_clinica')).toBe(true);
    await expect(exigirTratamentoPermitido(prisma, 'd1', 'partilha_familiares')).rejects.toThrow(ForbiddenException);
  });

  it('consentimento registado permite; a revogação fecha os acessos de familiares', async () => {
    await svc.registar('d1', { finalidade: 'partilha_familiares', decisao: 'consentimento' }, 'presencial', 'u1');
    expect(await tratamentoPermitido(prisma, 'd1', 'partilha_familiares')).toBe(true);
    expect(prisma.acessoFamiliar.updateMany).not.toHaveBeenCalled();

    const r = await svc.revogar('d1', 'partilha_familiares', 'portal', null);
    expect(r).toMatchObject({ revogado: true, acessosFamiliaresRevogados: 2 });
    expect(await tratamentoPermitido(prisma, 'd1', 'partilha_familiares')).toBe(false);
    expect(prisma.acessoFamiliar.updateMany).toHaveBeenCalledWith({ where: { doenteId: 'd1', ativo: true }, data: { ativo: false } });
  });

  it('revogar o portal desactiva a conta', async () => {
    await svc.registar('d1', { finalidade: 'portal_doente', decisao: 'consentimento' }, 'presencial', 'u1');
    const r = await svc.revogar('d1', 'portal_doente', 'portal', null);
    expect(r.contaPortalDesactivada).toBe(true);
  });

  it('nova decisão substitui a anterior e o histórico fica', async () => {
    await svc.registar('d1', { finalidade: 'partilha_familiares', decisao: 'consentimento' }, 'presencial', 'u1');
    await svc.registar('d1', { finalidade: 'partilha_familiares', decisao: 'oposicao' }, 'portal', null);
    expect(await tratamentoPermitido(prisma, 'd1', 'partilha_familiares')).toBe(false);
    expect(prisma.linhas).toHaveLength(2);
    expect(prisma.linhas[0].revogadoEm).toBeInstanceOf(Date);
    expect(prisma.linhas[0].origemRevogacao).toBe('portal');
  });

  it('oposição à IA: bloqueia o doente e retirá-la repõe', async () => {
    await svc.registar('d2', { finalidade: 'ia_clinica', decisao: 'oposicao' }, 'portal', null);
    await expect(exigirTratamentoPermitido(prisma, 'd2', 'ia_clinica')).rejects.toThrow(/opôs-se/);
    expect([...(await doentesComOposicaoIA(prisma, ['d1', 'd2']))]).toEqual(['d2']);
    await svc.revogar('d2', 'ia_clinica', 'presencial', 'u1');
    expect(await tratamentoPermitido(prisma, 'd2', 'ia_clinica')).toBe(true);
  });

  it('"consentir" a IA não é uma decisão: retira-se a oposição', async () => {
    await expect(svc.registar('d1', { finalidade: 'ia_clinica', decisao: 'consentimento' }, 'portal', null)).rejects.toThrow(BadRequestException);
  });

  it('valida finalidade, doente e existência de decisão em vigor', async () => {
    await expect(svc.registar('d1', { finalidade: 'marketing', decisao: 'consentimento' }, 'portal', null)).rejects.toThrow(BadRequestException);
    await expect(svc.registar('inexistente', { finalidade: 'portal_doente', decisao: 'consentimento' }, 'presencial', 'u1')).rejects.toThrow(NotFoundException);
    await expect(svc.revogar('d1', 'portal_doente', 'portal', null)).rejects.toThrow(NotFoundException);
  });

  it('estado resume as três finalidades', async () => {
    await svc.registar('d1', { finalidade: 'portal_doente', decisao: 'consentimento' }, 'presencial', 'u1');
    const e = await svc.estado('d1');
    expect(e.finalidades.map((f) => [f.finalidade, f.permitido])).toEqual([
      ['partilha_familiares', false], ['portal_doente', true], ['ia_clinica', true],
    ]);
    expect(e.historico).toHaveLength(1);
  });
});
