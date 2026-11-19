import { BadRequestException } from '@nestjs/common';
import { Hl7Service } from './hl7.service';

/** PROD-14 — ADT com efeito, emparelhado pelo identificador do HIS, com ACK. */
describe('Hl7Service', () => {
  const msh = (tipo: string) => `MSH|^~\\&|SONHO|HOSP|CURASPHERE|HOSP|20261119083000||${tipo}|M1|P|2.5`;
  const pid = 'PID|1||123456^^^HIS^PI~987654321^^^SNS^NH||Silva^Maria||19500505|F';
  const msg = (tipo: string, ...seg: string[]) => [msh(tipo), ...seg].join('\r');

  let prisma: any;
  let alertas: any;
  let service: Hl7Service;

  beforeEach(() => {
    const tx = {
      doente: { findFirst: jest.fn().mockResolvedValue({ numeroProcesso: `${new Date().getFullYear()}-00000041` }), create: jest.fn().mockResolvedValue({ id: 'novo' }) },
    };
    prisma = {
      hl7Mensagem: { create: jest.fn().mockResolvedValue({}) },
      doente: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
      ficheiroPessoalDoente: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      episodioInternamento: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
      resultadoAnalise: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((fn: any) => fn(tx)),
      _tx: tx,
    };
    alertas = { criarAlerta: jest.fn().mockResolvedValue(undefined) };
    service = new Hl7Service(prisma, alertas);
  });

  const doente = (extra: Record<string, unknown> = {}) => ({ id: 'd1', nome: 'Maria Silva', identificadorHis: '123456', estadoRegisto: 'internado', ativo: true, ...extra });

  it('sem MSH → 400', async () => {
    await expect(service.receberMensagem('PID|1||x')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('tipo não suportado: recusado (AR) e registado como não processado — não "processado" em silêncio', async () => {
    const r = await service.receberMensagem(msg('SIU^S12'));
    expect(r).toMatchObject({ processado: false, tipo: 'SIU^S12' });
    expect(r.ack).toMatch(/MSA\|AR\|M1/);
    expect(prisma.hl7Mensagem.create.mock.calls[0][0].data).toMatchObject({ processado: false, direcao: 'entrada' });
  });

  it('A01 de doente desconhecido: regista-o pendente de cama, com identificador do HIS e SNS', async () => {
    const r = await service.receberMensagem(msg('ADT^A01^ADT_A01', pid, 'PV1|1|I|MED^12^12A'));
    expect(r).toMatchObject({ processado: true, doenteId: 'novo', efeito: expect.stringMatching(/pendente de cama \(MED\)/) });
    expect(prisma._tx.doente.create.mock.calls[0][0].data).toMatchObject({
      nome: 'Maria Silva', identificadorHis: '123456', sexo: 'feminino', estadoRegisto: 'pendente_cama',
      numeroProcesso: `${new Date().getFullYear()}-00000042`,
    });
    expect(prisma.ficheiroPessoalDoente.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { doenteId: 'novo', numeroSNS: '987654321' } }));
    expect(r.ack).toMatch(/MSA\|AA\|M1/);
  });

  it('emparelha pelo identificador do HIS, depois pelo SNS (e liga o identificador do HIS)', async () => {
    prisma.doente.findUnique.mockResolvedValueOnce(doente());
    await service.receberMensagem(msg('ADT^A08', pid));
    expect(prisma.doente.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'd1' } }));

    prisma.doente.update.mockClear();
    prisma.ficheiroPessoalDoente.findFirst.mockResolvedValueOnce({ doente: doente({ identificadorHis: null }) });
    const r = await service.receberMensagem(msg('ADT^A08', pid));
    expect(r.doenteId).toBe('d1');
    expect(prisma.doente.update.mock.calls[0][0].data).toMatchObject({ identificadorHis: '123456' });
  });

  it('A08 de doente desconhecido: erro (AE), sem criar nada', async () => {
    const r = await service.receberMensagem(msg('ADT^A08', pid));
    expect(r).toMatchObject({ processado: false, erro: expect.stringMatching(/não encontrado/) });
    expect(r.ack).toMatch(/MSA\|AE/);
  });

  it('A02: atualiza o serviço do episódio e avisa a equipa para confirmar a cama', async () => {
    prisma.doente.findUnique.mockResolvedValue(doente());
    prisma.episodioInternamento.findFirst.mockResolvedValue({ id: 'ep1', servico: 'MED' });
    const r = await service.receberMensagem(msg('ADT^A02', pid, 'PV1|1|I|CIR^3^3B'));
    expect(prisma.episodioInternamento.update).toHaveBeenCalledWith({ where: { id: 'ep1' }, data: { servico: 'CIR' } });
    expect(alertas.criarAlerta).toHaveBeenCalledWith('d1', 'adt_transferencia', expect.stringMatching(/CIR \/ 3 \/ 3B/), 2);
    expect(r.processado).toBe(true);
  });

  it('A03 com o doente ainda internado no CuraSphere: não dá alta clínica por mensagem — avisa a equipa', async () => {
    prisma.doente.findUnique.mockResolvedValue(doente());
    prisma.episodioInternamento.findFirst.mockResolvedValue({ id: 'ep1', servico: 'MED' });
    const r = await service.receberMensagem(msg('ADT^A03', pid));
    expect(alertas.criarAlerta).toHaveBeenCalledWith('d1', 'adt_alta_sem_alta_clinica', expect.any(String), 3);
    expect(r.efeito).toMatch(/equipa avisada/);
  });

  it('A03 de doente já com alta no CuraSphere: conciliada, sem alerta', async () => {
    prisma.doente.findUnique.mockResolvedValue(doente({ estadoRegisto: 'ambulatorio' }));
    const r = await service.receberMensagem(msg('ADT^A03', pid));
    expect(r.efeito).toMatch(/conciliada/);
    expect(alertas.criarAlerta).not.toHaveBeenCalled();
  });

  it('ORU^R01: resultados no doente emparelhado pelo HIS', async () => {
    prisma.doente.findUnique.mockResolvedValue(doente());
    const r = await service.receberMensagem(msg('ORU^R01', pid, 'OBX|1|NM|2160-0^Creatinina||1,8|mg/dL|0.6-1.2|H'));
    expect(prisma.resultadoAnalise.create.mock.calls[0][0].data).toMatchObject({ doenteId: 'd1', parametro: 'Creatinina', valor: 1.8, alterado: true });
    expect(r.efeito).toBe('1 resultado(s) de análise registado(s)');
  });
});
