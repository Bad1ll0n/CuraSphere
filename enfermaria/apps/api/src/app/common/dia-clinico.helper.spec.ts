import {
  chaveDiaClinico,
  inicioDoDiaClinico,
  somarDiasClinicos,
} from './dia-clinico.helper';

/**
 * Estes testes fixam a zona explicitamente em vez de herdarem a do processo. É a razão
 * de existirem: o defeito original (BE-03) passava em CI, que corre em UTC, e só falhava
 * em produção, em `Europe/Lisbon`. Um teste que herdasse a zona do runner reproduziria
 * exactamente essa cegueira.
 */
const LISBOA = 'Europe/Lisbon';

describe('dia-clinico.helper', () => {
  describe('chaveDiaClinico', () => {
    it('dá o dia do hospital, não o dia UTC, para um registo do fim da noite no verão', () => {
      // 3 de Setembro, 23:30 em Lisboa (UTC+1) = 22:30Z do mesmo dia.
      const instante = new Date('2026-09-03T22:30:00Z');
      expect(chaveDiaClinico(instante, LISBOA)).toBe('2026-09-03');
    });

    it('é o caso que o código antigo errava: 00:30 local no verão pertence ao dia local', () => {
      // 4 de Setembro, 00:30 em Lisboa = 3 de Setembro, 23:30Z.
      // `toISOString().split('T')[0]` daria '2026-09-03' — o dia anterior.
      const instante = new Date('2026-09-03T23:30:00Z');
      expect(chaveDiaClinico(instante, LISBOA)).toBe('2026-09-04');
      expect(instante.toISOString().split('T')[0]).toBe('2026-09-03');
    });

    it('no inverno, com Lisboa em UTC, coincide com a data UTC', () => {
      const instante = new Date('2026-01-15T23:30:00Z');
      expect(chaveDiaClinico(instante, LISBOA)).toBe('2026-01-15');
    });
  });

  describe('inicioDoDiaClinico', () => {
    it('devolve a meia-noite de Lisboa, que no verão são 23:00Z do dia anterior', () => {
      const inicio = inicioDoDiaClinico(new Date('2026-09-03T14:00:00Z'), LISBOA);
      expect(inicio.toISOString()).toBe('2026-09-02T23:00:00.000Z');
      // E o dia clínico desse instante continua a ser o dia certo.
      expect(chaveDiaClinico(inicio, LISBOA)).toBe('2026-09-03');
    });

    it('no inverno a meia-noite de Lisboa é meia-noite UTC', () => {
      const inicio = inicioDoDiaClinico(new Date('2026-01-15T14:00:00Z'), LISBOA);
      expect(inicio.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    });

    it('é idempotente — o início do dia de um início de dia é ele próprio', () => {
      const inicio = inicioDoDiaClinico(new Date('2026-09-03T14:00:00Z'), LISBOA);
      expect(inicioDoDiaClinico(inicio, LISBOA).toISOString()).toBe(inicio.toISOString());
    });

    it('acerta no dia em que os relógios mudam (fim do horário de verão)', () => {
      // Em 2026 o horário de verão termina em Portugal a 25 de Outubro.
      const inicio = inicioDoDiaClinico(new Date('2026-10-25T12:00:00Z'), LISBOA);
      expect(chaveDiaClinico(inicio, LISBOA)).toBe('2026-10-25');
      // A meia-noite de 25/10 ainda é hora de verão: 23:00Z de dia 24.
      expect(inicio.toISOString()).toBe('2026-10-24T23:00:00.000Z');
    });
  });

  describe('somarDiasClinicos', () => {
    it('avança dias civis sem deslizar na mudança de hora', () => {
      const inicio = inicioDoDiaClinico(new Date('2026-10-24T12:00:00Z'), LISBOA);
      const chaves = [0, 1, 2, 3].map((n) =>
        chaveDiaClinico(somarDiasClinicos(inicio, n, LISBOA), LISBOA),
      );
      // Sem o tratamento do desvio, o dia da mudança repetir-se-ia ou saltaria.
      expect(chaves).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
    });

    it('atravessa a fronteira do mês', () => {
      const inicio = inicioDoDiaClinico(new Date('2026-08-30T12:00:00Z'), LISBOA);
      expect(chaveDiaClinico(somarDiasClinicos(inicio, 3, LISBOA), LISBOA)).toBe('2026-09-02');
    });
  });
});
