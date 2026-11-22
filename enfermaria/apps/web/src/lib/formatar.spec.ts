import { capitalizarPrimeira, formatarDiaMes, formatarEuros } from './formatar';

const sp = (s: string) => s.replace(/\s/g, ' '); // o Intl usa espaços não separáveis

describe('formatar (UX-20)', () => {
  it('euros à portuguesa', () => {
    expect(sp(formatarEuros(0))).toBe('0 €');
    expect(sp(formatarEuros(1234))).toMatch(/^1 ?234 €$/);
    expect(sp(formatarEuros(12345, { compacto: true }))).toBe('12,3 mil €');
    expect(sp(formatarEuros(undefined))).toBe('0 €');
  });
  it('dia/mês', () => {
    expect(formatarDiaMes('2026-10-23')).toBe('23/10');
    expect(formatarDiaMes('2026-10-23T10:00:00Z')).toBe('23/10');
  });
  it('só a primeira maiúscula', () => {
    expect(capitalizarPrimeira('quinta-feira, 5 de novembro')).toBe('Quinta-feira, 5 de novembro');
  });
});
