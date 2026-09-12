import {
  calcularNEWS2,
  calcularNEWS2Detalhado,
  NEWS2_LIMIAR_CRITICO,
  NEWS2_LIMIAR_ESCALADA,
  NEWS2_PARAMETROS,
} from './news2.helper';

/**
 * NEWS2 (Royal College of Physicians, 2017). As faixas de pontuação são normativas —
 * estes testes fixam-nas nos VALORES DE FRONTEIRA, para que qualquer alteração futura
 * às faixas tenha de ser deliberada.
 */
describe('news2.helper', () => {
  /** Observação de base com os 5 vitais numéricos normais (score 0). */
  const normal = {
    frequenciaRespiratoria: 15,
    saturacaoO2: 98,
    temperatura: 37,
    pressaoSistolica: 120,
    pulso: 70,
    o2Suplementar: false,
    avpu: 'A',
  };

  describe('calcularNEWS2 — score total', () => {
    it('observação completamente normal pontua 0', () => {
      expect(calcularNEWS2(normal)).toBe(0);
    });

    it('devolve null com menos de 3 vitais numéricos', () => {
      expect(calcularNEWS2({ pulso: 70, temperatura: 37 })).toBeNull();
      expect(calcularNEWS2({ pulso: 70 })).toBeNull();
      expect(calcularNEWS2({})).toBeNull();
    });

    it('calcula com exactamente 3 vitais numéricos', () => {
      expect(calcularNEWS2({ pulso: 70, temperatura: 37, saturacaoO2: 98 })).toBe(0);
    });

    it('O₂ suplementar vale +2 e é independente da SpO₂', () => {
      expect(calcularNEWS2({ ...normal, o2Suplementar: true })).toBe(2);
    });

    it('AVPU diferente de A vale +3', () => {
      for (const avpu of ['V', 'P', 'U']) {
        expect(calcularNEWS2({ ...normal, avpu })).toBe(3);
      }
    });
  });

  // ── Fronteiras por parâmetro ──────────────────────────────────────────────

  describe('fronteiras — frequência respiratória', () => {
    const fr = (v: number) => calcularNEWS2({ ...normal, frequenciaRespiratoria: v });
    it.each([
      [8, 3], [9, 1], [11, 1], [12, 0], [20, 0], [21, 2], [24, 2], [25, 3], [30, 3],
    ])('FR=%i → %i pontos', (valor, esperado) => expect(fr(valor)).toBe(esperado));
  });

  describe('fronteiras — SpO₂', () => {
    const spo2 = (v: number) => calcularNEWS2({ ...normal, saturacaoO2: v });
    it.each([
      [91, 3], [92, 2], [93, 2], [94, 1], [95, 1], [96, 0], [100, 0],
    ])('SpO₂=%i → %i pontos', (valor, esperado) => expect(spo2(valor)).toBe(esperado));
  });

  describe('fronteiras — temperatura', () => {
    const temp = (v: number) => calcularNEWS2({ ...normal, temperatura: v });
    it.each([
      [35.0, 3], [35.1, 1], [36.0, 1], [36.1, 0], [38.0, 0], [38.1, 1], [39.0, 1], [39.1, 2],
    ])('T=%p → %i pontos', (valor, esperado) => expect(temp(valor)).toBe(esperado));
  });

  describe('fronteiras — TA sistólica', () => {
    const pas = (v: number) => calcularNEWS2({ ...normal, pressaoSistolica: v });
    it.each([
      [90, 3], [91, 2], [100, 2], [101, 1], [110, 1], [111, 0], [219, 0], [220, 3],
    ])('PAS=%i → %i pontos', (valor, esperado) => expect(pas(valor)).toBe(esperado));
  });

  describe('fronteiras — pulso', () => {
    const fc = (v: number) => calcularNEWS2({ ...normal, pulso: v });
    it.each([
      [40, 3], [41, 1], [50, 1], [51, 0], [90, 0], [91, 1], [110, 1], [111, 2], [130, 2], [131, 3],
    ])('FC=%i → %i pontos', (valor, esperado) => expect(fc(valor)).toBe(esperado));
  });

  // ── Gatilho RCP: 3 num parâmetro isolado ──────────────────────────────────

  describe('parâmetro isolado a 3 (gatilho RCP)', () => {
    it('FR=30 dá total 3 mas sinaliza parâmetro isolado em vermelho', () => {
      const d = calcularNEWS2Detalhado({ ...normal, frequenciaRespiratoria: 30 });
      expect(d.score).toBe(3);
      expect(d.score).toBeLessThan(NEWS2_LIMIAR_ESCALADA);
      expect(d.parametroIsoladoTres).toBe(true);
      expect(d.parametrosVermelhos).toEqual(['frequenciaRespiratoria']);
    });

    it('observação normal não tem parâmetros vermelhos', () => {
      const d = calcularNEWS2Detalhado(normal);
      expect(d.parametroIsoladoTres).toBe(false);
      expect(d.parametrosVermelhos).toEqual([]);
    });

    it('identifica vários parâmetros vermelhos em simultâneo', () => {
      const d = calcularNEWS2Detalhado({ ...normal, frequenciaRespiratoria: 30, pressaoSistolica: 85 });
      expect(d.parametrosVermelhos).toEqual(
        expect.arrayContaining(['frequenciaRespiratoria', 'pressaoSistolica']),
      );
      expect(d.score).toBe(6);
      expect(d.score).toBeGreaterThanOrEqual(NEWS2_LIMIAR_ESCALADA);
    });

    it('sinaliza parâmetro vermelho mesmo quando não há score (menos de 3 vitais)', () => {
      const d = calcularNEWS2Detalhado({ pressaoSistolica: 85 });
      expect(d.score).toBeNull();
      expect(d.parametroIsoladoTres).toBe(true);
    });
  });

  // ── Dados parciais ────────────────────────────────────────────────────────

  describe('dados parciais — "não medido" ≠ "normal"', () => {
    it('marca completo quando os 7 parâmetros estão presentes', () => {
      const d = calcularNEWS2Detalhado(normal);
      expect(d.completo).toBe(true);
      expect(d.parametrosEmFalta).toEqual([]);
      expect(d.parametrosPresentes).toHaveLength(NEWS2_PARAMETROS.length);
      expect(d.conclusivo).toBe(true);
    });

    it('lista os parâmetros em falta em vez de os pontuar a 0', () => {
      const d = calcularNEWS2Detalhado({ frequenciaRespiratoria: 15, saturacaoO2: 98, temperatura: 37 });
      expect(d.score).toBe(0);
      expect(d.completo).toBe(false);
      expect(d.parametrosEmFalta).toEqual(
        expect.arrayContaining(['pressaoSistolica', 'pulso', 'avpu', 'o2Suplementar']),
      );
      expect(d.subscores.pressaoSistolica).toBeUndefined();
    });

    it('score 0 sobre 3 de 7 parâmetros NÃO é conclusivo', () => {
      const d = calcularNEWS2Detalhado({ frequenciaRespiratoria: 15, saturacaoO2: 98, temperatura: 37 });
      // Pior caso: PAS 3 + pulso 3 + AVPU 3 = 9 (O₂ ausente lê-se como ar ambiente).
      expect(d.scoreMaximoPossivel).toBe(9);
      expect(d.conclusivo).toBe(false);
    });

    it('os 5 vitais numéricos normais são conclusivos (só falta AVPU, pior caso 3)', () => {
      const d = calcularNEWS2Detalhado({
        frequenciaRespiratoria: 15, saturacaoO2: 98, temperatura: 37,
        pressaoSistolica: 120, pulso: 70,
      });
      expect(d.completo).toBe(false);
      expect(d.scoreMaximoPossivel).toBe(3);
      expect(d.scoreMaximoPossivel).toBeLessThan(NEWS2_LIMIAR_ESCALADA);
      expect(d.conclusivo).toBe(true);
    });

    it('um score já acima do limiar é conclusivo mesmo com dados em falta', () => {
      const d = calcularNEWS2Detalhado({ frequenciaRespiratoria: 28, saturacaoO2: 89, pressaoSistolica: 85 });
      expect(d.score).toBe(9);
      expect(d.score).toBeGreaterThanOrEqual(NEWS2_LIMIAR_CRITICO);
      expect(d.completo).toBe(false);
      expect(d.conclusivo).toBe(true);
    });

    it('o2Suplementar=false conta como medido; ausente conta como em falta', () => {
      expect(calcularNEWS2Detalhado({ ...normal, o2Suplementar: false }).parametrosEmFalta).toEqual([]);
      const semO2 = calcularNEWS2Detalhado({ ...normal, o2Suplementar: undefined });
      expect(semO2.parametrosEmFalta).toEqual(['o2Suplementar']);
      // ...mas a ausência de registo de O₂ não torna o score inconclusivo (ar ambiente).
      expect(semO2.conclusivo).toBe(true);
    });

    it('avpu="A" conta como medido (doente alerta), não como ausente', () => {
      const d = calcularNEWS2Detalhado({ ...normal, avpu: 'A' });
      expect(d.subscores.avpu).toBe(0);
      expect(d.parametrosEmFalta).toEqual([]);
    });
  });

  describe('limiares exportados', () => {
    it('correspondem ao RCP (5 = urgente, 7 = imediato)', () => {
      expect(NEWS2_LIMIAR_ESCALADA).toBe(5);
      expect(NEWS2_LIMIAR_CRITICO).toBe(7);
    });
  });
});
