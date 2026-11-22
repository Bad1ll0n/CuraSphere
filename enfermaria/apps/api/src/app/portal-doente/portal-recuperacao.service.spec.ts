import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PortalRecuperacaoService } from './portal-recuperacao.service';

const sha = (t: string) => createHash('sha256').update(t).digest('hex');

function montar() {
  const prisma: any = {
    portalDoente: { findUnique: jest.fn(), update: jest.fn() },
    recuperacaoPortal: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), create: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const redis: any = { del: jest.fn().mockResolvedValue(undefined) };
  const mailer: any = { enviar: jest.fn().mockResolvedValue(undefined) };
  return { prisma, redis, mailer, service: new PortalRecuperacaoService(prisma, redis, mailer) };
}

const PORTAL = { id: 'p1', email: 'maria@exemplo.pt', ativo: true, doente: { ativo: true, nome: 'Maria Silva' } };

describe('PortalRecuperacaoService (UX-28)', () => {
  it('a resposta é igual exista ou não a conta, e sem conta não envia nada', async () => {
    const a = montar();
    a.prisma.portalDoente.findUnique.mockResolvedValue(null);
    const semConta = await a.service.pedir('ninguem@exemplo.pt', 'https://h.pt');
    const b = montar();
    b.prisma.portalDoente.findUnique.mockResolvedValue(PORTAL);
    const comConta = await b.service.pedir('maria@exemplo.pt', 'https://h.pt');
    expect(semConta).toEqual(comConta);
    expect(a.mailer.enviar).not.toHaveBeenCalled();
    expect(b.mailer.enviar).toHaveBeenCalledTimes(1);
  });

  it('guarda só o hash do token; o token vai no link; os pedidos anteriores deixam de valer', async () => {
    const { prisma, mailer, service } = montar();
    prisma.portalDoente.findUnique.mockResolvedValue(PORTAL);
    await service.pedir('maria@exemplo.pt', 'https://h.pt/');
    const html: string = mailer.enviar.mock.calls[0][0].html;
    const token = decodeURIComponent(/token=([^"&]+)/.exec(html)![1]);
    const criado = prisma.recuperacaoPortal.create.mock.calls[0][0].data;
    expect(criado.tokenHash).toBe(sha(token));
    expect(JSON.stringify(criado)).not.toContain(token);
    expect(html).toContain('https://h.pt/portal/login/redefinir?token=');
    expect(prisma.recuperacaoPortal.updateMany).toHaveBeenCalledWith({ where: { portalId: 'p1', usadoEm: null }, data: { usadoEm: expect.any(Date) } });
  });

  it('redefine com link válido, aplica a política de password e levanta o bloqueio', async () => {
    const { prisma, redis, service } = montar();
    prisma.recuperacaoPortal.findUnique.mockResolvedValue({ id: 'r1', portalId: 'p1', usadoEm: null, expiraEm: new Date(Date.now() + 60_000), portal: PORTAL });
    await expect(service.redefinir('tok', 'cavalo bateria agrafo')).resolves.toEqual({ ok: true });
    expect(prisma.portalDoente.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { passwordHash: expect.any(String) } });
    expect(redis.del).toHaveBeenCalledWith('portal:login:lock:p1', 'portal:login:fail:p1');
    await expect(service.redefinir('tok', 'password')).rejects.toThrow(BadRequestException);
  });

  it('link expirado, já usado ou usado ao mesmo tempo noutro separador: recusado', async () => {
    const { prisma, service } = montar();
    prisma.recuperacaoPortal.findUnique.mockResolvedValueOnce({ id: 'r1', portalId: 'p1', usadoEm: null, expiraEm: new Date(Date.now() - 1), portal: PORTAL });
    await expect(service.redefinir('tok', 'cavalo bateria agrafo')).rejects.toThrow(/expirou/);
    prisma.recuperacaoPortal.findUnique.mockResolvedValueOnce({ id: 'r1', portalId: 'p1', usadoEm: new Date(), expiraEm: new Date(Date.now() + 60_000), portal: PORTAL });
    await expect(service.redefinir('tok', 'cavalo bateria agrafo')).rejects.toThrow(/expirou/);
    prisma.recuperacaoPortal.findUnique.mockResolvedValueOnce({ id: 'r1', portalId: 'p1', usadoEm: null, expiraEm: new Date(Date.now() + 60_000), portal: PORTAL });
    prisma.recuperacaoPortal.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.redefinir('tok', 'cavalo bateria agrafo')).rejects.toThrow(/expirou/);
    expect(prisma.portalDoente.update).not.toHaveBeenCalled();
  });
});
