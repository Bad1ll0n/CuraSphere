import { NotFoundException } from '@nestjs/common';
import { RegrasCliniciasService } from './regras-clinicas.service';

// QA-21 — módulo sem spec: regras clínicas configuráveis.
describe('RegrasCliniciasService', () => {
  let prisma: any, svc: RegrasCliniciasService;
  beforeEach(() => {
    prisma = {
      regraClinica: {
        findMany: jest.fn(), findUnique: jest.fn(),
        create: jest.fn(async ({ data }) => data), update: jest.fn(async ({ data }) => data), delete: jest.fn(),
      },
    };
    svc = new RegrasCliniciasService(prisma);
  });

  it('listar filtra por activa só quando pedido', async () => {
    await svc.listar();
    expect(prisma.regraClinica.findMany.mock.calls[0][0].where).toBeUndefined();
    await svc.listar(false);
    expect(prisma.regraClinica.findMany.mock.calls[1][0].where).toEqual({ ativa: false });
  });

  it('cria activa, com autor', async () => {
    const r = await svc.criar('u1', { nome: 'NEWS2 ≥ 7', condicao: { news2: { gte: 7 } }, acoes: [{ tipo: 'alerta' }] });
    expect(r).toMatchObject({ ativa: true, criadoPorId: 'u1', servicoId: null });
  });

  it('actualizar só mexe nos campos enviados (desactivar não apaga a condição)', async () => {
    prisma.regraClinica.findUnique.mockResolvedValue({ id: 'r1' });
    expect(await svc.atualizar('r1', { ativa: false })).toEqual({ ativa: false });
  });

  it('regra inexistente → 404 ao actualizar e ao apagar', async () => {
    prisma.regraClinica.findUnique.mockResolvedValue(null);
    await expect(svc.atualizar('x', { nome: 'y' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.apagar('x')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.regraClinica.delete).not.toHaveBeenCalled();
  });
});
