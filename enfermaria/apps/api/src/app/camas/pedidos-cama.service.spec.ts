import { BadRequestException, ConflictException } from '@nestjs/common';
import { PedidosCamaService } from './pedidos-cama.service';

// PROD-03 — pedido de cama: pedido → cama atribuída (reservada) → ocupada (episódio aberto).
describe('PedidosCamaService', () => {
  let tx: any, prisma: any, svc: PedidosCamaService;
  const camas = { invalidarCache: jest.fn().mockResolvedValue(undefined) };
  beforeEach(() => {
    jest.clearAllMocks();
    tx = {
      pedidoCama: { findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn((a: any) => Promise.resolve({ id: 'p1', ...a.data })), update: jest.fn((a: any) => Promise.resolve({ id: a.where.id, ...a.data })), findMany: jest.fn(), count: jest.fn() },
      doente: { findUnique: jest.fn(), update: jest.fn() },
      cama: { findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      episodioInternamento: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn((a: any) => Promise.resolve({ id: 'ep-1', ...a.data })), update: jest.fn() },
      planoAlta: { create: jest.fn() },
    };
    prisma = { ...tx, $transaction: jest.fn((fn: any) => fn(tx)) };
    svc = new PedidosCamaService(prisma, { tenantId: 'default' } as any, camas as any);
  });

  it('criar: herda sexo e isolamento do doente; recusa quem já está numa cama', async () => {
    tx.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: true, camaId: null, sexo: 'feminino', emIsolamento: true });
    const p = await svc.criar({ doenteId: 'd1', origem: 'urgencia', servicoDestino: 'Medicina' }, 'u1');
    expect(p).toMatchObject({ sexo: 'feminino', isolamento: true, pedidoPorId: 'u1', origem: 'urgencia' });
    tx.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: true, camaId: 'c9' });
    await expect(svc.criar({ doenteId: 'd1', origem: 'urgencia', servicoDestino: 'Medicina' }, 'u1')).rejects.toThrow(/transferência interna/);
  });

  it('criar: sem doente nem nome temporário → 400; pedido em aberto → 409', async () => {
    await expect(svc.criar({ origem: 'bloco', servicoDestino: 'Cirurgia' }, 'u1')).rejects.toThrow(BadRequestException);
    tx.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: true, camaId: null });
    tx.pedidoCama.findFirst.mockResolvedValue({ id: 'p0' });
    await expect(svc.criar({ doenteId: 'd1', origem: 'urgencia', servicoDestino: 'Medicina' }, 'u1')).rejects.toThrow(ConflictException);
  });

  it('atribuir: cama de enfermaria masculina para doente feminina → 409; com justificação reserva', async () => {
    tx.pedidoCama.findUnique.mockResolvedValue({ id: 'p1', estado: 'pedido', sexo: 'feminino', isolamento: false, camaId: null });
    tx.cama.findUnique.mockResolvedValue({ id: 'c1', sexo: 'masculino', isolamento: false });
    await expect(svc.atribuir('p1', { camaId: 'c1' }, 'u1')).rejects.toThrow(/CAMA_INCOMPATIVEL/);
    const r = await svc.atribuir('p1', { camaId: 'c1', justificacao: 'Única cama livre; quarto individual' }, 'u1');
    expect(tx.cama.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'reservada', reservadaPedidoId: 'p1' }) }));
    expect(r).toMatchObject({ estado: 'atribuida', camaId: 'c1', justificacaoAtribuicao: 'Única cama livre; quarto individual' });
    expect(camas.invalidarCache).toHaveBeenCalled();
  });

  it('ocupar: sem cama atribuída → 400; com cama abre o episódio (urgência) e interna o doente', async () => {
    tx.pedidoCama.findUnique.mockResolvedValue({ id: 'p1', estado: 'pedido' });
    await expect(svc.ocupar('p1', {}, 'u1')).rejects.toThrow(/Atribua uma cama/);

    tx.pedidoCama.findUnique.mockResolvedValue({ id: 'p1', estado: 'atribuida', camaId: 'c1', doenteId: 'd1', origem: 'urgencia', episodioUrgenciaId: 'eu1', diagnostico: 'Pneumonia' });
    tx.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: true, camaId: null, diagnosticoPrincipal: null });
    tx.cama.findUniqueOrThrow.mockResolvedValue({ id: 'c1', servico: 'Medicina' });
    const r = await svc.ocupar('p1', {}, 'u1');
    expect(tx.episodioInternamento.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ origem: 'urgencia', camaId: 'c1', episodioUrgenciaId: 'eu1', pedidoCamaId: 'p1', diagnosticoPrincipal: 'Pneumonia' }),
    }));
    expect(tx.doente.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estadoRegisto: 'internado', camaId: 'c1' }) }));
    expect(r).toMatchObject({ estado: 'ocupada', ocupadaEm: expect.any(Date) });
  });

  it('cancelar: liberta a cama reservada para o pedido', async () => {
    tx.pedidoCama.findUnique.mockResolvedValue({ id: 'p1', estado: 'atribuida', camaId: 'c1' });
    await svc.cancelar('p1', 'Doente transferido para outro hospital');
    expect(tx.cama.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', estado: 'reservada', reservadaPedidoId: 'p1' },
      data: { estado: 'livre', reservadaPedidoId: null, reservadaAte: null },
    });
  });
});
