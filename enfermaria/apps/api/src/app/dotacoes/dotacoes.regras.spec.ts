import { PARAMETROS_REFERENCIA as P, calcularDotacao, categoriaDependencia, gerarEscala, validarParametros, type Parametros, type Profissional } from './dotacoes.regras';

describe('dotação segura — regras (PROD-17)', () => {
  describe('categoria de dependência', () => {
    it('base no Barthel; sem Barthel, II', () => {
      expect(categoriaDependencia({ barthel: 100, news2: 0, intervencoesDia: 0 })).toBe('I');
      expect(categoriaDependencia({ barthel: 75, news2: 0, intervencoesDia: 0 })).toBe('II');
      expect(categoriaDependencia({ barthel: 40, news2: 0, intervencoesDia: 0 })).toBe('III');
      expect(categoriaDependencia({ barthel: 10, news2: 0, intervencoesDia: 0 })).toBe('IV');
      expect(categoriaDependencia({ barthel: null, news2: null, intervencoesDia: 0 })).toBe('II');
    });
    it('sobe um nível com NEWS2 ≥ 5 ou ≥ 12 intervenções/dia (sem passar de IV)', () => {
      expect(categoriaDependencia({ barthel: 100, news2: 5, intervencoesDia: 0 })).toBe('II');
      expect(categoriaDependencia({ barthel: 75, news2: 0, intervencoesDia: 12 })).toBe('III');
      expect(categoriaDependencia({ barthel: 10, news2: 9, intervencoesDia: 20 })).toBe('IV');
    });
  });

  describe('cálculo', () => {
    it('horas necessárias pela dependência no turno vs disponíveis pelos enfermeiros escalados', () => {
      // 10 doentes: 4×II (16 h), 4×III (24 h), 2×IV (18 h) = 58 h/24 h; manhã 45 % = 26,1 h.
      const cats = [...Array(4).fill('II'), ...Array(4).fill('III'), ...Array(2).fill('IV')];
      const r = calcularDotacao(cats, 3, 'manha', P);
      expect(r).toMatchObject({ doentes: 10, porCategoria: { I: 0, II: 4, III: 4, IV: 2 }, horasNecessarias: 26.1, horasDisponiveis: 21, enfermeiros: 3, enfermeirosNecessarios: 4 });
      expect(r.racio).toBeCloseTo(0.8, 2);
      expect(r.semaforo).toBe('vermelho');
      expect(calcularDotacao(cats, 4, 'manha', P).semaforo).toBe('verde');
    });
    it('abaixo do mínimo de enfermeiros é sempre vermelho; sem doentes, "sem_doentes"', () => {
      expect(calcularDotacao(['I'], 1, 'noite', P).semaforo).toBe('vermelho'); // mínimo 2
      expect(calcularDotacao([], 2, 'noite', P)).toMatchObject({ semaforo: 'sem_doentes', racio: null });
    });
    it('amarelo entre 0,85 e 1', () => {
      // 4×IV = 36 h; tarde 35 % = 12,6 h; 2 enfermeiros × 7 = 14 h → verde; com 6 h efetivas = 12 h → 0,95 amarelo.
      expect(calcularDotacao(Array(4).fill('IV'), 2, 'tarde', { ...P, horasEfetivasTurno: 6 }).semaforo).toBe('amarelo');
    });
  });

  it('valida os parâmetros', () => {
    expect(validarParametros(P)).toEqual([]);
    expect(validarParametros({ ...P, distribuicaoTurno: { manha: 0.5, tarde: 0.5, noite: 0.5 } })[0]).toMatch(/somar 1/);
    expect(validarParametros({ ...P, horasEfetivasTurno: 9 })[0]).toMatch(/efetivas/);
  });

  describe('escala', () => {
    const dias = ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11', '2026-12-12', '2026-12-13'];
    const enf = (n: number, comp: string[] = []): Profissional[] => Array.from({ length: n }, (_, i) => ({ id: `e${i}`, role: 'enfermeiro', competencias: comp }));
    const so = (min: number): Parametros => ({ ...P, minimos: { manha: { enfermeiro: min, auxiliar: 0, medico: 0 }, tarde: { enfermeiro: min, auxiliar: 0, medico: 0 }, noite: { enfermeiro: min, auxiliar: 0, medico: 0 } } });
    const base = { ausente: () => false, existentes: new Set<string>() };

    it('cumpre os mínimos quando há pessoal, sem ninguém em dois turnos no mesmo dia', () => {
      const { turnos, faltas } = gerarEscala({ ...base, dias, profissionais: enf(10), p: so(2) });
      expect(faltas).toEqual([]);
      expect(turnos).toHaveLength(21);
      for (const d of dias) {
        const ids = turnos.filter((t) => t.data === d).flatMap((t) => t.ids);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });

    it('descanso após a noite (sem manhã nem tarde no dia seguinte), no máximo duas noites seguidas e limite semanal', () => {
      const { turnos } = gerarEscala({ ...base, dias, profissionais: enf(10), p: so(2) });
      const porPessoa = new Map<string, { data: string; tipo: string }[]>();
      for (const t of turnos) for (const id of t.ids) porPessoa.set(id, [...(porPessoa.get(id) ?? []), { data: t.data, tipo: t.tipo }]);
      for (const [, ts] of porPessoa) {
        ts.sort((a, b) => a.data.localeCompare(b.data));
        for (let i = 1; i < ts.length; i++) {
          const seguido = (Date.parse(ts[i].data) - Date.parse(ts[i - 1].data)) === 86_400_000;
          if (seguido && ts[i - 1].tipo === 'noite') expect(ts[i].tipo).toBe('noite');
          if (i >= 2 && seguido && ts[i].tipo === 'noite' && ts[i - 1].tipo === 'noite') {
            expect(Date.parse(ts[i - 1].data) - Date.parse(ts[i - 2].data) === 86_400_000 && ts[i - 2].tipo === 'noite').toBe(false);
          }
        }
        expect(ts.length * 8).toBeLessThanOrEqual(40);
      }
    });

    it('o que não se consegue cumprir aparece em faltas (não se esconde)', () => {
      const { faltas } = gerarEscala({ ...base, dias: dias.slice(0, 1), profissionais: enf(3), p: so(2) });
      // A noite leva dois; sobra um para a manhã e nenhum para a tarde.
      expect(faltas).toEqual([{ data: '2026-12-07', tipo: 'manha', motivo: 'enfermeiro: 1 de 2' }, { data: '2026-12-07', tipo: 'tarde', motivo: 'enfermeiro: 0 de 2' }]);
    });

    it('competência obrigatória: pelo menos um enfermeiro com ela por turno, ou falta', () => {
      const pessoas = [...enf(6), { id: 'sav1', role: 'enfermeiro' as const, competencias: ['SAV'] }, { id: 'sav2', role: 'enfermeiro' as const, competencias: ['SAV'] }, { id: 'sav3', role: 'enfermeiro' as const, competencias: ['SAV'] }];
      const { turnos, faltas } = gerarEscala({ ...base, dias: dias.slice(0, 1), profissionais: pessoas, p: { ...so(2), competenciaObrigatoria: 'SAV' } });
      for (const t of turnos) expect(t.ids.some((id) => id.startsWith('sav'))).toBe(true);
      expect(faltas).toEqual([]);
      expect(gerarEscala({ ...base, dias: dias.slice(0, 1), profissionais: enf(6), p: { ...so(2), competenciaObrigatoria: 'SAV' } }).faltas.map((f) => f.motivo)).toContain('sem enfermeiro com SAV');
    });

    it('respeita ausências e turnos já existentes na escala', () => {
      const { turnos } = gerarEscala({ dias: dias.slice(0, 1), profissionais: enf(6), ausente: (id) => id === 'e0', existentes: new Set(['2026-12-07_noite']), p: so(2) });
      expect(turnos.map((t) => t.tipo)).toEqual(['manha', 'tarde']);
      expect(turnos.flatMap((t) => t.ids)).not.toContain('e0');
    });
  });
});
