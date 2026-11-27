import { BadRequestException, ConflictException } from '@nestjs/common';
import { exigirCompatibilidade, problemasCompatibilidade, abrirEpisodio, fecharEpisodio, ocuparCama } from './episodios.core';
import { EpisodiosService } from './episodios.service';

function txMock() {
  return {
    episodioInternamento: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    planoAlta: { create: jest.fn().mockResolvedValue({}) },
    doente: { findUnique: jest.fn(), update: jest.fn() },
    cama: { updateMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    movimentoInternamento: { create: jest.fn() },
    notaTurno: { create: jest.fn() },
    alergia: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

describe('PROD-03 — compatibilidade doente/cama', () => {
  it('sexo da enfermaria e isolamento', () => {
    expect(problemasCompatibilidade({ sexo: null, isolamento: false }, { sexo: 'feminino' })).toEqual([]);
    expect(problemasCompatibilidade({ sexo: 'masculino', isolamento: false }, { sexo: 'feminino' })).toHaveLength(1);
    expect(problemasCompatibilidade({ sexo: 'masculino', isolamento: false }, { sexo: 'indeterminado' })).toEqual([]);
    expect(problemasCompatibilidade({ sexo: null, isolamento: false }, { emIsolamento: true })[0]).toMatch(/isolamento/);
    expect(problemasCompatibilidade({ sexo: null, isolamento: true }, { emIsolamento: true })).toEqual([]);
  });

  it('incompatível → 409, salvo justificação com pelo menos 10 caracteres', () => {
    expect(exigirCompatibilidade([], undefined)).toBeNull();
    expect(() => exigirCompatibilidade(['x'], 'curta')).toThrow(ConflictException);
    expect(() => exigirCompatibilidade(['x'], undefined)).toThrow(/CAMA_INCOMPATIVEL/);
    expect(exigirCompatibilidade(['x'], '  única cama livre no serviço  ')).toBe('única cama livre no serviço');
  });
});

describe('PROD-02 — episódio de internamento', () => {
  it('abre o episódio seguinte (n.º 3) com o seu plano de alta', async () => {
    const tx = txMock();
    tx.episodioInternamento.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ numero: 2 });
    tx.episodioInternamento.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'ep-3', ...data }));
    const ep = await abrirEpisodio(tx, { doenteId: 'd1', origem: 'reinternamento', alergiasRevistas: false });
    expect(ep).toMatchObject({ numero: 3, origem: 'reinternamento' });
    expect(ep).not.toHaveProperty('alergiasRevistasEm');
    expect(tx.planoAlta.create).toHaveBeenCalledWith({ data: { doenteId: 'd1', episodioId: 'ep-3' } });
  });

  it('não abre um segundo episódio activo', async () => {
    const tx = txMock();
    tx.episodioInternamento.findFirst.mockResolvedValue({ id: 'ep-1', numero: 1 });
    await expect(abrirEpisodio(tx, { doenteId: 'd1', origem: 'admissao' })).rejects.toThrow(ConflictException);
  });

  it('fechar: actualiza o activo com alta, motivo e destino', async () => {
    const tx = txMock();
    tx.episodioInternamento.findFirst.mockResolvedValue({ id: 'ep-1', numero: 1 });
    tx.episodioInternamento.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'ep-1', ...data }));
    const ep = await fecharEpisodio(tx, 'd1', { motivoAlta: 'melhorado', destinoAlta: 'domicilio' });
    expect(ep).toMatchObject({ estado: 'alta', motivoAlta: 'melhorado', destinoAlta: 'domicilio', dataAlta: expect.any(Date) });
  });

  it('ocupar cama: só livre (ou reservada para este pedido); ocupada → 400; inexistente → 404', async () => {
    const tx = txMock();
    tx.cama.updateMany.mockResolvedValue({ count: 0 });
    tx.cama.findUnique.mockResolvedValue({ estado: 'ocupada' });
    await expect(ocuparCama(tx, 'c1')).rejects.toThrow(/não está disponível/);
    tx.cama.findUnique.mockResolvedValue({ estado: 'reservada', reservadaPedidoId: 'outro' });
    await expect(ocuparCama(tx, 'c1', 'p1')).rejects.toThrow(/reservada para outro pedido/);
    tx.cama.findUnique.mockResolvedValue(null);
    await expect(ocuparCama(tx, 'c1')).rejects.toThrow(/não encontrada/);
  });
});

describe('EpisodiosService', () => {
  let tx: any, prisma: any, svc: EpisodiosService;
  const camas = { invalidarCache: jest.fn().mockResolvedValue(undefined) };
  beforeEach(() => {
    tx = txMock();
    prisma = { ...tx, $transaction: jest.fn((fn: any) => fn(tx)) };
    svc = new EpisodiosService(prisma, camas as any);
  });

  it('reinternar: recusa quem tem registo activo', async () => {
    tx.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: true });
    await expect(svc.reinternar('d1', 'u1', { diagnosticoPrincipal: 'x' })).rejects.toThrow(BadRequestException);
  });

  it('reinternar: novo episódio, alergias de trás por rever, doente activo na cama', async () => {
    tx.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: false, sexo: 'feminino', emIsolamento: false });
    tx.cama.findUnique.mockResolvedValue({ sexo: 'feminino', isolamento: false });
    tx.cama.updateMany.mockResolvedValue({ count: 1 });
    tx.cama.findUniqueOrThrow.mockResolvedValue({ id: 'c1', servico: 'Medicina' });
    tx.episodioInternamento.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ numero: 1 });
    tx.episodioInternamento.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'ep-2', ...data }));
    tx.doente.update.mockResolvedValue({ id: 'd1' });
    tx.alergia.findMany.mockResolvedValue([{ id: 'a1', alergenio: 'Penicilina' }]);

    const r = await svc.reinternar('d1', 'u1', { camaId: 'c1', diagnosticoPrincipal: 'Pneumonia' });
    expect(r.episodio).toMatchObject({ numero: 2, origem: 'reinternamento', servico: 'Medicina' });
    expect(r.alergiasARever).toHaveLength(1);
    expect(tx.doente.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ativo: true, estadoRegisto: 'internado', camaId: 'c1', dataAlta: null }),
    }));
    expect(camas.invalidarCache).toHaveBeenCalled();
  });

  it('transferir: mesma cama → 400; cama incompatível sem justificação → 409', async () => {
    tx.doente.findUnique.mockResolvedValue({ id: 'd1', ativo: true, camaId: 'c1', sexo: 'feminino', cama: { id: 'c1', servico: 'Medicina' } });
    await expect(svc.transferir('d1', 'u1', { camaId: 'c1', motivo: 'agravamento' })).rejects.toThrow(/já está nessa cama/);
    tx.cama.findUnique.mockResolvedValue({ sexo: 'masculino', isolamento: false });
    await expect(svc.transferir('d1', 'u1', { camaId: 'c2', motivo: 'agravamento' })).rejects.toThrow(ConflictException);
    expect(tx.cama.updateMany).not.toHaveBeenCalled();
  });

  it('transferir de serviço: ocupa a nova, liberta a antiga, regista movimento e nota de passagem', async () => {
    tx.doente.findUnique.mockResolvedValue({
      id: 'd1', nome: 'Ana', ativo: true, camaId: 'c1', sexo: 'feminino', emIsolamento: false,
      cama: { id: 'c1', numero: '1', quarto: '10', servico: 'Medicina' },
    });
    tx.cama.findUnique.mockResolvedValue({ sexo: null, isolamento: true });
    tx.cama.updateMany.mockResolvedValue({ count: 1 });
    tx.cama.findUniqueOrThrow.mockResolvedValue({ id: 'c2', numero: '3', quarto: 'U1', servico: 'UCI' });
    tx.episodioInternamento.findFirst.mockResolvedValue({ id: 'ep-1', numero: 1 });
    tx.movimentoInternamento.create.mockImplementation(({ data }: any) => Promise.resolve(data));

    const r = await svc.transferir('d1', 'u1', { camaId: 'c2', motivo: 'Agravamento respiratório' });
    expect(r.movimento).toMatchObject({ tipo: 'servico', deServico: 'Medicina', paraServico: 'UCI', deCamaId: 'c1', paraCamaId: 'c2' });
    expect(tx.cama.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { estado: 'em_limpeza' } });
    expect(tx.episodioInternamento.update).toHaveBeenCalledWith({ where: { id: 'ep-1' }, data: { camaId: 'c2', servico: 'UCI' } });
    expect(tx.notaTurno.create.mock.calls[0][0].data.texto).toMatch(/Transferência de serviço: 10\/1 \(Medicina\) → U1\/3 \(UCI\)/);
  });

  it('indicador: reinternamento até 30 dias depois da alta', async () => {
    const d = (s: string) => new Date(s);
    prisma.episodioInternamento.findMany
      .mockResolvedValueOnce([
        { id: 'e1', doenteId: 'a', numero: 1, dataAlta: d('2026-10-01') },
        { id: 'e2', doenteId: 'b', numero: 1, dataAlta: d('2026-10-01') },
      ])
      .mockResolvedValueOnce([
        { doenteId: 'a', numero: 2, dataAdmissao: d('2026-10-20') }, // 19 dias → conta
        { doenteId: 'b', numero: 2, dataAdmissao: d('2026-12-01') }, // 61 dias → não conta
      ]);
    const r = await svc.indicadorReinternamentos(30, '2026-09-01', '2026-11-01');
    expect(r).toMatchObject({ altas: 2, reinternamentos: 1, taxa: 50 });
  });
});
