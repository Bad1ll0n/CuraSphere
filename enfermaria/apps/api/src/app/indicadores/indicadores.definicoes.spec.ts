import { DEFINICOES, diasInternamento, mediana, percentagem, por1000, reinternamentos, sobreposicao, turnosCompletos } from './indicadores.definicoes';
import { registoNotifica, classeIcps } from '../eventos-adversos/icps';

const d = (s: string) => new Date(s);

describe('indicadores — definições (PROD-18)', () => {
  it('todas as definições têm versão, numerador, denominador e exclusões, e códigos únicos', () => {
    for (const x of DEFINICOES) {
      expect(x.versao).toBeTruthy();
      expect(x.numerador.length).toBeGreaterThan(10);
      expect(x.denominador.length).toBeGreaterThan(10);
      expect(x.exclusoes.length).toBeGreaterThan(5);
    }
    expect(new Set(DEFINICOES.map((x) => x.codigo)).size).toBe(DEFINICOES.length);
  });

  it('dias de internamento: só a parte de cada episódio dentro do período', () => {
    const ini = d('2026-11-01T00:00:00Z'), fim = d('2026-11-11T00:00:00Z');
    const eps = [
      { id: 'a', doenteId: 'x', numero: 1, dataAdmissao: d('2026-10-30T00:00:00Z'), dataAlta: d('2026-11-03T00:00:00Z') }, // 2 dias dentro
      { id: 'b', doenteId: 'y', numero: 1, dataAdmissao: d('2026-11-05T12:00:00Z'), dataAlta: null }, // 5,5 dias dentro
    ];
    expect(diasInternamento(eps, ini, fim)).toBe(7.5);
    expect(sobreposicao(d('2026-12-01T00:00:00Z'), null, ini, fim)).toBe(0);
  });

  it('taxas, percentagens e mediana', () => {
    expect(por1000(3, 1500)).toBe(2);
    expect(por1000(1, 0)).toBeNull();
    expect(percentagem(2, 3)).toBe(66.7);
    expect(mediana([30, 10, 20])).toBe(20);
    expect(mediana([10, 20, 30, 40])).toBe(25);
    expect(mediana([])).toBeNull();
  });

  it('turnos completos: só os que o doente esteve internado do início ao fim', () => {
    const t = turnosCompletos({ id: 'a', doenteId: 'x', numero: 1, dataAdmissao: d('2026-11-01T10:00:00Z'), dataAlta: d('2026-11-02T09:00:00Z') }, d('2026-11-01T00:00:00Z'), d('2026-11-10T00:00:00Z'));
    // 16–24 de dia 1, 00–08 de dia 2 (08–16 de dia 1 começou antes da admissão; 08–16 de dia 2 acaba depois da alta).
    expect(t.map(([a]) => a.toISOString())).toEqual(['2026-11-01T16:00:00.000Z', '2026-11-02T00:00:00.000Z']);
  });

  it('reinternamento a 30 dias: conta a alta seguida de novo internamento, exclui óbitos', () => {
    const eps = [
      { id: '1', doenteId: 'x', numero: 1, dataAdmissao: d('2026-10-01T00:00:00Z'), dataAlta: d('2026-11-02T00:00:00Z'), motivoAlta: 'domicilio' },
      { id: '2', doenteId: 'x', numero: 2, dataAdmissao: d('2026-11-20T00:00:00Z'), dataAlta: null },
      { id: '3', doenteId: 'y', numero: 1, dataAdmissao: d('2026-10-01T00:00:00Z'), dataAlta: d('2026-11-03T00:00:00Z'), motivoAlta: 'domicilio' },
      { id: '4', doenteId: 'y', numero: 2, dataAdmissao: d('2026-12-20T00:00:00Z'), dataAlta: null }, // > 30 dias
      { id: '5', doenteId: 'z', numero: 1, dataAdmissao: d('2026-10-01T00:00:00Z'), dataAlta: d('2026-11-04T00:00:00Z'), motivoAlta: 'obito' },
    ];
    const r = reinternamentos(eps, d('2026-11-01T00:00:00Z'), d('2026-12-01T00:00:00Z'));
    expect(r.altas.map((a) => a.id)).toEqual(['1', '3']);
    expect(r.casos.map((a) => a.id)).toEqual(['1']);
  });
});

describe('ICPS e NOTIFICA (PROD-18)', () => {
  it('classe ICPS escolhida, deduzida do tipo, ou recusada se desconhecida', () => {
    expect(classeIcps('queda')).toBe('acidente_doente');
    expect(classeIcps('outro', 'documentacao')).toBe('documentacao');
    expect(classeIcps('outro', 'xpto')).toBeNull();
    expect(classeIcps('outro')).toBeNull();
  });

  it('registo NOTIFICA: anónimo, com classe ICPS e grau de dano; quase-incidente sem dano', () => {
    const base = { id: 'e1', descricao: 'Queda ao levantar', servicoId: 'internamento', acaoCorretiva: 'Grade', ocorridoEm: d('2026-11-10T03:20:00Z'), classeIcps: null };
    const r = registoNotifica({ ...base, tipo: 'queda', gravidade: 'dano_leve' });
    expect(r).toEqual({
      referenciaInterna: 'e1', dataOcorrencia: '2026-11-10', horaOcorrencia: '03:20', tipoIncidenteIcps: 'acidente_doente',
      tipoIncidenteIcpsDescricao: expect.stringMatching(/quedas/), quaseIncidente: false, grauDano: 'ligeiro',
      servico: 'internamento', descricao: 'Queda ao levantar', acoesTomadas: 'Grade',
    });
    expect(Object.keys(r).filter((k) => /doente|registadoPor|nome|processo/i.test(k))).toEqual([]);
    expect(registoNotifica({ ...base, tipo: 'near_miss', gravidade: 'dano_grave' })).toMatchObject({ quaseIncidente: true, grauDano: 'nenhum' });
  });
});
