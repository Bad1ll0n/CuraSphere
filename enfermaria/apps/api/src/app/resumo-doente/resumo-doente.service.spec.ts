import { BadRequestException } from '@nestjs/common';
import { ResumoDoenteService } from './resumo-doente.service';

// UX-29 / UX-30 — faixa de identificação, DNR e "O meu turno".
describe('ResumoDoenteService', () => {
  let prisma: any, vig: any, svc: ResumoDoenteService;
  beforeEach(() => {
    prisma = {
      doente: { findUnique: jest.fn(), update: jest.fn((a: any) => Promise.resolve(a.data)), findMany: jest.fn() },
      atribuicaoDoente: { findMany: jest.fn().mockResolvedValue([{ doenteId: 'd1' }]) },
      atribuicaoHorarioTurno: { findMany: jest.fn().mockResolvedValue([]) },
    };
    vig = { doDoente: jest.fn().mockResolvedValue([{ tipo: 'braden', motivo: 'Avaliação inicial em falta', atrasoMinutos: 30 }, { tipo: 'morse', motivo: 'x', atrasoMinutos: 0 }]) };
    svc = new ResumoDoenteService(prisma, vig);
  });

  it('faixa: alergias, DNR, risco de queda e NEWS2 com tendência', async () => {
    prisma.doente.findUnique.mockResolvedValue({
      id: 'd1', nome: 'Ana Silva', numeroProcesso: 'P1', dataNascimento: new Date('1950-01-01'), sexo: 'feminino', estado: 'estavel',
      pesoReferenciaKg: 60, emIsolamento: true, motivoIsolamento: 'MRSA', avaliacaoAlergias: 'com_alergias',
      decisaoNaoReanimar: true, decisaoNaoReanimarEm: new Date(), cama: { numero: '1', quarto: '10', servico: 'Medicina' },
      alergias: [{ alergenio: 'Penicilina', severidade: 'grave' }],
      sinaisVitais: [{ news2: 6, data: new Date() }, { news2: 3, data: new Date() }],
      avaliacoesRisco: [{ tipo: 'morse', risco: 'alto', pontuacao: 55 }], sinalizacoes: [],
    });
    const f = await svc.faixa('d1');
    expect(f).toMatchObject({ isolamento: 'MRSA', naoReanimar: { em: expect.any(Date) }, riscoQueda: { risco: 'alto' }, news2: { valor: 6, tendencia: 'sobe' }, pesoKg: 60 });
    expect(f.alergias.lista).toHaveLength(1);
  });

  it('DNR exige fundamentação; revogar não', async () => {
    prisma.doente.findUnique.mockResolvedValue({ id: 'd1' });
    await expect(svc.definirNaoReanimar('d1', 'med', { ativo: true, notas: 'curta' })).rejects.toThrow(BadRequestException);
    const r = await svc.definirNaoReanimar('d1', 'med', { ativo: true, notas: 'Decisão em reunião com a família e a equipa' });
    expect(r).toMatchObject({ decisaoNaoReanimar: true, decisaoNaoReanimarPorId: 'med' });
    expect(await svc.definirNaoReanimar('d1', 'med', { ativo: false })).toMatchObject({ decisaoNaoReanimar: false });
  });

  it('meu turno: conta medicação em atraso/devida, observações em atraso e tarefas', async () => {
    const agora = Date.now();
    prisma.doente.findMany.mockResolvedValue([{
      id: 'd1', nome: 'Ana', numeroProcesso: 'P1', dataNascimento: null, estado: 'estavel', emIsolamento: false, avaliacaoAlergias: 'nao_avaliado',
      decisaoNaoReanimar: false, cama: null, alergias: [], sinaisVitais: [],
      tarefas: [{ prioridade: 'urgente' }, { prioridade: 'normal' }],
      // De hora a hora, iniciada há 6 h, sem administrações: há tomas em atraso e uma devida agora.
      medicacoes: [{ id: 'm1', nome: 'X', frequencia: '1/1h', iniciadoEm: new Date(agora - 6 * 3_600_000), registos: [] }],
    }]);
    const r = await svc.meuTurno('enf-1');
    const l = r.doentes[0];
    expect(l.doente.alergias).toBeNull();
    expect(l.medicacao.emAtraso).toBeGreaterThan(0);
    expect(l.observacoesEmAtraso).toEqual([{ tipo: 'braden', motivo: 'Avaliação inicial em falta', atrasoMinutos: 30 }]);
    expect(l.tarefas).toEqual({ pendentes: 2, urgentes: 1 });
  });

  it('sem doentes atribuídos: lista vazia', async () => {
    prisma.atribuicaoDoente.findMany.mockResolvedValue([]);
    expect(await svc.meuTurno('enf-1')).toEqual({ doentes: [] });
  });
});
