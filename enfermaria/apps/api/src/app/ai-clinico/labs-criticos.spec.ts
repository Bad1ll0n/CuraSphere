import { alertasDeLabs } from './labs-criticos';

describe('análises críticas do watchdog', () => {
  it('assinala troponina, lactato, hemoglobina e leucócitos fora dos limites', () => {
    const a = alertasDeLabs([
      { parametro: 'Troponina I', valor: 0.1 }, { parametro: 'Lactato', valor: '3.1' },
      { parametro: 'Hb', valor: 6.5 }, { parametro: 'Leucocitos', valor: 15 }, { parametro: 'Sódio', valor: 140 },
    ]);
    expect(a).toEqual(['Troponina elevada: 0.1 µg/L', 'Lactato elevado: 3.1 mmol/L', 'Hemoglobina crítica: 6.5 g/dL', 'Leucócitos anómalos: 15 ×10⁹/L']);
  });

  it('progressão da creatinina (mais recente primeiro) e valores não numéricos ignorados', () => {
    expect(alertasDeLabs([{ parametro: 'Creatinina', valor: 1.6 }, { parametro: 'Creatinina', valor: 'x' }, { parametro: 'Creatinina', valor: 1.1 }]))
      .toEqual(['Progressão creatinina: 1.1 → 1.6 mg/dL (AKI suspeito)']);
    expect(alertasDeLabs([])).toEqual([]);
  });
});
