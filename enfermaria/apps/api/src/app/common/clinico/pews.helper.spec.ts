import { calcularPEWS, idadeEmMeses } from './pews.helper';

describe('calcularPEWS', () => {
  it('devolve 0 para vitais normais de um lactente (6 meses)', () => {
    // lactente: RR normal 30–60, HR normal 100–160
    expect(calcularPEWS({ frequenciaRespiratoria: 40, pulso: 130, saturacaoO2: 98, temperatura: 37 }, 6)).toBe(0);
  });

  it('pontua taquipneia/taquicardia por faixa etária (criança 8 anos)', () => {
    // 8 anos (96 meses): RR normal 18–30, HR normal 70–120
    const score = calcularPEWS(
      { frequenciaRespiratoria: 45, pulso: 150, saturacaoO2: 97, temperatura: 37 },
      96,
    );
    expect(score).toBeGreaterThan(0);
  });

  it('mesmos vitais dão scores diferentes conforme a idade', () => {
    const vitais = { frequenciaRespiratoria: 45, pulso: 150, saturacaoO2: 98, temperatura: 37 };
    const lactente = calcularPEWS(vitais, 6)!; // 45/150 estão dentro do normal do lactente
    const crianca = calcularPEWS(vitais, 96)!; // fora do normal aos 8 anos
    expect(crianca).toBeGreaterThan(lactente);
  });

  it('pontua SpO2 baixa e alteração de consciência', () => {
    const score = calcularPEWS(
      { frequenciaRespiratoria: 40, pulso: 130, saturacaoO2: 88, temperatura: 37, avpu: 'P' },
      6,
    )!;
    expect(score).toBeGreaterThanOrEqual(6); // SpO2<90 (+3) + AVPU≠A (+3)
  });

  it('devolve null com menos de 3 vitais', () => {
    expect(calcularPEWS({ frequenciaRespiratoria: 40, pulso: 130 }, 6)).toBeNull();
  });

  it('devolve null para idade ≥16 anos (usar NEWS2)', () => {
    expect(calcularPEWS({ frequenciaRespiratoria: 20, pulso: 80, saturacaoO2: 98, temperatura: 37 }, 200)).toBeNull();
  });
});

describe('idadeEmMeses', () => {
  it('calcula os meses entre datas', () => {
    expect(idadeEmMeses('2020-01-01', new Date('2021-01-01'))).toBe(12);
    expect(idadeEmMeses('2020-01-01', new Date('2020-07-01'))).toBe(6);
  });
});
