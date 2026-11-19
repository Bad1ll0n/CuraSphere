import { BadRequestException } from '@nestjs/common';
import { PlaneamentoAltaService } from './planeamento-alta.service';

describe('PlaneamentoAltaService (PROD-13)', () => {
  let prisma: any;
  let service: PlaneamentoAltaService;
  const ativo = { id: 'ep1', estado: 'ativo', servico: 'MED' };

  beforeEach(() => {
    prisma = {
      doente: { findUnique: jest.fn().mockResolvedValue({ id: 'd1' }) },
      episodioInternamento: { findFirst: jest.fn().mockResolvedValue(ativo) },
      planoAlta: { findUnique: jest.fn(), upsert: jest.fn(), findMany: jest.fn() },
      escalaClinica: { findFirst: jest.fn() },
      avaliacaoInicialEnfermagem: { findFirst: jest.fn() },
      referenciacaoContinuidade: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
      ensinoDoente: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    };
    service = new PlaneamentoAltaService(prisma);
  });

  it('resumo: dias após a alta clínica e sinalização a partir do Barthel e da avaliação inicial', async () => {
    prisma.planoAlta.findUnique.mockResolvedValue({ altaClinicaEm: new Date(Date.now() - 3.5 * 86_400_000) });
    prisma.escalaClinica.findFirst.mockResolvedValue({ pontuacao: 35, registadaEm: new Date() });
    prisma.avaliacaoInicialEnfermagem.findFirst.mockResolvedValue({ dados: {} });
    const r = await service.resumo('d1');
    expect(r.diasAposAltaClinica).toBe(3);
    expect(r.sinalizacao.map((s) => s.motivo)).toEqual(['dependencia', 'sem_cuidador']);
    expect(prisma.escalaClinica.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { doenteId: 'd1', tipo: 'Barthel' } }));
  });

  it('referenciação: destino desconhecido é recusado; a criada começa "proposta" com histórico', async () => {
    await expect(service.criarReferenciacao('d1', 'u1', { destino: 'spa', motivo: 'Precisa de apoio' })).rejects.toBeInstanceOf(BadRequestException);
    prisma.referenciacaoContinuidade.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'r1', ...data }));
    const r = await service.criarReferenciacao('d1', 'u1', { destino: 'rncci_convalescenca', motivo: ' Pós-fratura do colo do fémur ' });
    expect(r).toMatchObject({ destino: 'rncci_convalescenca', motivo: 'Pós-fratura do colo do fémur', episodioId: 'ep1' });
    expect((r as any).historico[0]).toMatchObject({ estado: 'proposta', porId: 'u1' });
  });

  it('referenciação: transição inválida e recusa sem motivo são recusadas; a válida marca a data', async () => {
    prisma.referenciacaoContinuidade.findUnique.mockResolvedValue({ id: 'r1', estado: 'proposta', historico: [] });
    await expect(service.alterarEstado('r1', 'u1', { estado: 'vaga_atribuida' })).rejects.toThrow(/Não é possível/);
    prisma.referenciacaoContinuidade.findUnique.mockResolvedValue({ id: 'r1', estado: 'enviada', historico: [] });
    await expect(service.alterarEstado('r1', 'u1', { estado: 'recusada' })).rejects.toThrow(/motivo/);
    prisma.referenciacaoContinuidade.updateMany.mockResolvedValue({ count: 1 });
    await service.alterarEstado('r1', 'u1', { estado: 'aceite', nota: 'ECL aceitou' });
    const { where, data } = prisma.referenciacaoContinuidade.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: 'r1', estado: 'enviada' });
    expect(data).toMatchObject({ estado: 'aceite', aceiteEm: expect.any(Date), nota: 'ECL aceitou' });
    expect(data.historico).toHaveLength(1);
  });

  it('referenciação alterada por outra pessoa entretanto → recusa', async () => {
    prisma.referenciacaoContinuidade.findUnique.mockResolvedValue({ id: 'r1', estado: 'proposta', historico: [] });
    prisma.referenciacaoContinuidade.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.alterarEstado('r1', 'u1', { estado: 'enviada' })).rejects.toThrow(/alterada entretanto/);
  });

  it('ensino: cuidador sem nome e "não compreendeu" sem nota são recusados', async () => {
    await expect(service.registarEnsino('d1', 'u1', { tema: 'insulina', destinatario: 'cuidador', compreensao: 'compreendeu' })).rejects.toThrow(/nome do cuidador/);
    await expect(service.registarEnsino('d1', 'u1', { tema: 'insulina', destinatario: 'doente', compreensao: 'parcial' })).rejects.toThrow(/o que falta/);
    await expect(service.registarEnsino('d1', 'u1', { tema: 'xpto', destinatario: 'doente', compreensao: 'compreendeu' })).rejects.toThrow(/desconhecido/);
    prisma.ensinoDoente.create.mockImplementation(({ data }: any) => Promise.resolve(data));
    const e = await service.registarEnsino('d1', 'u1', { tema: 'insulina', destinatario: 'ambos', cuidadorNome: 'Ana', compreensao: 'compreendeu' });
    expect(e).toMatchObject({ titulo: 'Administração de insulina e vigilância da glicemia', episodioId: 'ep1', cuidadorNome: 'Ana' });
  });

  it('sem internamento em curso não se referencia nem se marca alta clínica', async () => {
    prisma.episodioInternamento.findFirst.mockResolvedValue(null);
    await expect(service.marcarAltaClinica('d1', 'u1', true)).rejects.toThrow(/internamento em curso/);
  });

  it('altas proteladas: ordena pelos dias e mostra o que prende o doente', async () => {
    const dias = (n: number) => new Date(Date.now() - n * 86_400_000 - 3_600_000);
    prisma.planoAlta.findMany.mockResolvedValue([
      { doenteId: 'a', episodioId: 'e1', altaClinicaEm: dias(2), episodio: { servico: 'MED' }, doente: { nome: 'A', numeroProcesso: '1', cama: { numero: '3' } } },
      { doenteId: 'b', episodioId: 'e2', altaClinicaEm: dias(7), episodio: { servico: 'MED' }, doente: { nome: 'B', numeroProcesso: '2', cama: null } },
    ]);
    prisma.referenciacaoContinuidade.findMany.mockResolvedValue([
      { episodioId: 'e2', destino: 'rncci_longa_duracao', estado: 'enviada' },
      { episodioId: 'e2', destino: 'csp_ucc', estado: 'cancelada' },
    ]);
    const r = await service.altasProteladas('MED');
    expect(r).toMatchObject({ doentes: 2, diasTotal: 9 });
    expect(r.linhas[0]).toMatchObject({ doenteId: 'b', dias: 7, aguarda: [{ destino: 'rncci_longa_duracao', estado: 'enviada' }] });
  });
});
