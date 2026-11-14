import { BadRequestException } from '@nestjs/common';
import { avaliarEscala, avaliarRisco } from './escalas-motor';
import { superficieCorporal, tfgCkdEpi2021 } from './antropometria';
import { ESCALAS_DOR, eAnalgesico, intervalosDoServico, proximaAvaliacaoRisco, proximaAvaliacaoSinaisVitais, reavaliacaoDorAte } from './vigilancia';
import { codificarAlergenio } from '../medicacao/alergias.helper';

const H = 3_600_000;
const t0 = new Date('2026-11-07T08:00:00Z');

describe('PROD-08 — motor de escalas no servidor', () => {
  it('Glasgow: soma e classifica, ignorando o que o cliente diria', () => {
    expect(avaliarEscala('Glasgow', { ocular: 4, verbal: 5, motor: 6 })).toMatchObject({ pontuacao: 15, classificacao: 'ligeiro', versao: 'gcs-1' });
    expect(avaliarEscala('Glasgow', { ocular: '1', verbal: '1', motor: '1' })).toMatchObject({ pontuacao: 3, classificacao: 'grave' });
  });

  it('recusa itens em falta, valores fora da escala e itens desconhecidos', () => {
    expect(() => avaliarEscala('Glasgow', { ocular: 4, verbal: 5 })).toThrow(BadRequestException);
    expect(() => avaliarEscala('Glasgow', { ocular: 7, verbal: 5, motor: 6 })).toThrow(/não é admissível/);
    expect(() => avaliarEscala('Glasgow', { ocular: 4, verbal: 5, motor: 6, bonus: 3 })).toThrow(/desconhecidos/);
    expect(() => avaliarEscala('Inventada', {})).toThrow(/desconhecida/);
  });

  it('MRC tem 12 itens (0–60): força máxima é "Força normal"', () => {
    const grupos = ['abd', 'flex', 'ext_punho', 'flex_anca', 'ext_joelho', 'dors'];
    const todos = (v: number) => Object.fromEntries(grupos.flatMap((g) => [[`${g}_esq`, v], [`${g}_dir`, v]]));
    expect(avaliarEscala('MRC', todos(5))).toMatchObject({ pontuacao: 60, classificacao: 'Força normal' });
    expect(avaliarEscala('MRC', todos(2)).classificacao).toMatch(/grave/);
    const seis = Object.fromEntries(['abd', 'flex', 'dors'].flatMap((g) => [[`${g}_esq`, 5], [`${g}_dir`, 5]]));
    expect(() => avaliarEscala('MRC', seis)).toThrow(/em falta/);
  });

  it('PHQ-9: item 9 positivo avisa sempre, mesmo com total mínimo', () => {
    const v = { anedonia: 0, humor: 0, sono: 0, energia: 0, apetite: 0, autoestima: 0, concentracao: 0, psicomotor: 0, suicidio: 1 };
    expect(avaliarEscala('PHQ9', v).classificacao).toMatch(/item 9 positivo/);
  });

  it('Braden: cortes DGS (≤ 16 alto), configuráveis e versionados', () => {
    const b = (n: number) => ({ percepcaoSensorial: n, humidade: n, atividade: n, mobilidade: n, nutricao: n, friccaoCisalhamento: Math.min(n, 3) });
    expect(avaliarRisco('braden', b(2))).toMatchObject({ pontuacao: 12, risco: 'alto' });
    expect(avaliarRisco('braden', b(4))).toMatchObject({ pontuacao: 23, risco: 'baixo' });
    process.env['BRADEN_CORTE_ALTO'] = '12';
    try {
      const r = avaliarRisco('braden', { ...b(2), humidade: 3 });
      expect(r).toMatchObject({ pontuacao: 13, risco: 'baixo' });
      expect(r.versao).toContain('alto<=12');
    } finally { delete process.env['BRADEN_CORTE_ALTO']; }
  });

  it('Morse: baixo / moderado / alto', () => {
    const base = { historiaQueda: 0, diagnosticoSecundario: 0, ajudaMarcha: 0, heparinaIV: 0, marchaTransferencia: 0, estadoMental: 0 };
    expect(avaliarRisco('morse', base).risco).toBe('baixo');
    expect(avaliarRisco('morse', { ...base, historiaQueda: 25 }).risco).toBe('moderado');
    expect(avaliarRisco('morse', { ...base, historiaQueda: 25, ajudaMarcha: 30 }).risco).toBe('alto');
    expect(() => avaliarRisco('morse', { ...base, ajudaMarcha: 10 })).toThrow(BadRequestException);
  });
});

describe('PROD-22 — TFG CKD-EPI 2021 e superfície corporal', () => {
  it('valores de referência (creatinina 1,0 mg/dL, 50 anos)', () => {
    expect(tfgCkdEpi2021(1.0, 50, 'masculino')).toEqual({ tfg: 92 });
    expect(tfgCkdEpi2021(1.0, 50, 'feminino')).toEqual({ tfg: 69 });
  });

  it('sem sexo registado usa a estimativa mais baixa e explica', () => {
    const r = tfgCkdEpi2021(1.0, 50, null);
    expect(r.tfg).toBe(69);
    expect(r.nota).toMatch(/não registado/);
  });

  it('Mosteller', () => {
    expect(superficieCorporal(70, 170)).toBe(1.82);
  });
});

describe('PROD-10 — periodicidade da vigilância', () => {
  const sv = (news2: number | null, extra: object = {}) => proximaAvaliacaoSinaisVitais({ data: t0, news2, ...extra });

  it('NEWS2 decide quando volta a ser devido', () => {
    expect(sv(0).getTime() - t0.getTime()).toBe(12 * H);
    expect(sv(3).getTime() - t0.getTime()).toBe(4 * H);
    expect(sv(2, { news2ParametroIsolado3: true }).getTime() - t0.getTime()).toBe(1 * H);
    expect(sv(6).getTime() - t0.getTime()).toBe(1 * H);
    expect(sv(8).getTime() - t0.getTime()).toBe(0.25 * H);
    expect(sv(null).getTime() - t0.getTime()).toBe(4 * H);
    expect(sv(0, { news2Completo: false }).getTime() - t0.getTime()).toBe(4 * H);
  });

  it('intervalos ajustáveis por serviço; configuração inválida cai nas omissões', () => {
    process.env['VIGILANCIA_INTERVALOS'] = JSON.stringify({ UCI: { news2Zero: 2, bradenHoras: 24, lixo: 9 } });
    try {
      expect(sv(0).getTime() - t0.getTime()).toBe(12 * H);
      expect(proximaAvaliacaoSinaisVitais({ data: t0, news2: 0 }, 'UCI').getTime() - t0.getTime()).toBe(2 * H);
      expect(proximaAvaliacaoRisco('braden', t0, 'UCI').getTime() - t0.getTime()).toBe(24 * H);
      expect(intervalosDoServico('UCI')).not.toHaveProperty('lixo');
      process.env['VIGILANCIA_INTERVALOS'] = '{nao json';
      expect(intervalosDoServico('UCI').news2Zero).toBe(12);
    } finally { delete process.env['VIGILANCIA_INTERVALOS']; }
  });

  it('reavaliação da dor só depois de analgésicos: 30 min IV, 60 min outras vias', () => {
    expect(eAnalgesico('Paracetamol 1 g')).toBe(true);
    expect(eAnalgesico('Amoxicilina 500 mg')).toBe(false);
    expect(reavaliacaoDorAte('Morfina 2 mg', 'IV', t0)!.getTime() - t0.getTime()).toBe(30 * 60_000);
    expect(reavaliacaoDorAte('Paracetamol', 'oral', t0)!.getTime() - t0.getTime()).toBe(60 * 60_000);
    expect(reavaliacaoDorAte('Amoxicilina', 'IV', t0)).toBeNull();
  });

  it('PROD-09: CPOT vai até 8, as restantes escalas até 10', () => {
    expect(ESCALAS_DOR['cpot'].max).toBe(8);
    expect(ESCALAS_DOR['numerica'].max).toBe(10);
  });
});

describe('PROD-06 — alergénio codificado', () => {
  it('substância, classe ou texto livre', () => {
    expect(codificarAlergenio('Amoxicilina')).toEqual({ codigo: 'amoxicilina', sistemaCodigo: 'dci' });
    expect(codificarAlergenio('Penicilinas').sistemaCodigo).toBe('classe');
    expect(codificarAlergenio('Pó de casa').sistemaCodigo).toBe('livre');
  });
});
