import { NotFoundException } from '@nestjs/common';
import { TransferenciasService } from './transferencias.service';

// QA-21 — módulo sem spec: transferência externa de um doente.
describe('TransferenciasService', () => {
  let prisma: any, svc: TransferenciasService;
  beforeEach(() => {
    prisma = {
      doente: { findUnique: jest.fn() },
      transferenciaExterna: {
        create: jest.fn(async ({ data }) => ({ id: 't1', ...data })),
        findUnique: jest.fn(), update: jest.fn(async ({ data }) => data), findMany: jest.fn(),
      },
    };
    svc = new TransferenciasService(prisma);
  });

  it('doente inexistente → 404, nada é criado', async () => {
    prisma.doente.findUnique.mockResolvedValue(null);
    await expect(svc.criar('u1', { doenteId: 'x', hospitalDestino: 'H', servicoDestino: 'S', motivoTransfer: 'M' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.transferenciaExterna.create).not.toHaveBeenCalled();
  });

  it('cria pendente, com quem a pediu', async () => {
    prisma.doente.findUnique.mockResolvedValue({ id: 'd1' });
    const t = await svc.criar('u1', { doenteId: 'd1', hospitalDestino: 'HSM', servicoDestino: 'UCI', motivoTransfer: 'Cuidados intensivos' });
    expect(t).toMatchObject({ estado: 'pendente', solicitadoPorId: 'u1', notas: null });
  });

  it('aceite no destino regista quem aceitou; concluída regista quando', async () => {
    prisma.transferenciaExterna.findUnique.mockResolvedValue({ id: 't1' });
    expect(await svc.atualizarEstado('t1', 'u2', { estado: 'aceite_destino' })).toMatchObject({ estado: 'aceite_destino', aceitoPorId: 'u2' });
    const fim = await svc.atualizarEstado('t1', 'u2', { estado: 'concluida', notas: 'Saiu de ambulância' });
    expect(fim.concluidaEm).toBeInstanceOf(Date);
    expect(fim).not.toHaveProperty('aceitoPorId');
  });

  it('transferência inexistente → 404', async () => {
    prisma.transferenciaExterna.findUnique.mockResolvedValue(null);
    await expect(svc.atualizarEstado('x', 'u', { estado: 'concluida' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
