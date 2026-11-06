import { classificarTomas, horaLocal, horariosPadrao, parsearFrequenciaHoras, tomasPlaneadas } from './posologia';
import { inicioDoDiaClinico } from '../common/dia-clinico.helper';

// PROD-04: o formulário da web oferece "Nx/dia"; o parser antigo só lia "N/Nh".
describe('parsearFrequenciaHoras', () => {
  it.each([
    ['1x/dia', 24], ['2x/dia', 12], ['3x/dia', 8], ['4x/dia', 6], ['6x/dia', 4], ['8x/dia', 3],
    ['8/8h', 8], ['12/12h', 12], ['6 / 6 h', 6], ['q8h', 8], ['cada 6h', 6], ['de 4 em 4 horas', 4],
    ['3 vezes ao dia', 8], ['2 x dia', 12], ['bid', 12], ['tid', 8], ['qid', 6], ['id', 24],
  ])('"%s" → %ih', (f, h) => expect(parsearFrequenciaHoras(f)).toBe(h));

  it.each(['SOS', 'em SOS', 'se necessário', 'contínua', 'Contínuo', 'perfusão', '', 'texto livre', '5x/dia', '0/0h'])(
    '"%s" não tem horário fixo',
    (f) => expect(parsearFrequenciaHoras(f)).toBeNull(),
  );
});

describe('horariosPadrao', () => {
  it('âncora às 08:00', () => {
    expect(horariosPadrao(24)).toEqual([8]);
    expect(horariosPadrao(12)).toEqual([8, 20]);
    expect(horariosPadrao(8)).toEqual([0, 8, 16]);
    expect(horariosPadrao(6)).toEqual([2, 8, 14, 20]);
  });
});

describe('tomasPlaneadas', () => {
  // Dia de verão (UTC+1 em Lisboa) — a hora local tem de mandar, não a UTC.
  const dia = inicioDoDiaClinico(new Date('2026-07-15T12:00:00Z'));
  const h = (n: number) => new Date(dia.getTime() + n * 3_600_000);

  it('gera TODAS as tomas do turno, não só uma (q4h no turno da manhã = 08 e 12)', () => {
    const tomas = tomasPlaneadas('6x/dia', h(8), h(16));
    expect(tomas.map(horaLocal)).toEqual(['08:00', '12:00']);
  });

  it('usa a hora local do hospital (08:00 em Lisboa no verão = 07:00Z)', () => {
    const [t] = tomasPlaneadas('1x/dia', h(0), h(24));
    expect(t.toISOString()).toBe('2026-07-15T07:00:00.000Z');
  });

  it('não gera tomas antes do início da prescrição', () => {
    expect(tomasPlaneadas('3x/dia', h(0), h(24), h(10)).map(horaLocal)).toEqual(['16:00']);
  });

  it('SOS e perfusões não têm tomas planeadas', () => {
    expect(tomasPlaneadas('SOS', h(0), h(24))).toEqual([]);
    expect(tomasPlaneadas('contínua', h(0), h(24))).toEqual([]);
  });
});

describe('classificarTomas', () => {
  const t0 = new Date('2026-07-15T07:00:00Z');
  const t1 = new Date('2026-07-15T11:00:00Z');

  it('administrada dentro da janela, em atraso passada 1 h, devida antes disso', () => {
    const agora = new Date('2026-07-15T11:30:00Z');
    const r = classificarTomas([t0, t1], [new Date('2026-07-15T07:20:00Z')], agora);
    expect(r.map((x) => x.estado)).toEqual(['administrada', 'devida']);
    const tarde = classificarTomas([t0, t1], [], new Date('2026-07-15T12:30:00Z'));
    expect(tarde.map((x) => x.estado)).toEqual(['em_atraso', 'em_atraso']);
  });

  it('uma administração conta para uma só toma', () => {
    const r = classificarTomas([t0, new Date('2026-07-15T08:00:00Z')], [new Date('2026-07-15T07:30:00Z')], t1);
    expect(r.filter((x) => x.estado === 'administrada')).toHaveLength(1);
  });

  it('administração fora da janela não conta', () => {
    const r = classificarTomas([t0], [new Date('2026-07-15T10:30:00Z')], t1);
    expect(r[0].estado).toBe('em_atraso');
  });
});
