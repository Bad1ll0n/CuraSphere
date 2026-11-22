import { minutosLimiteEdicao, rotuloTurnoComHoras, turnoDaHora, turnoDeEscalaEmCurso } from '@org/shared';
import { filtroHorarioTurnoAtivo, turnoEmCurso } from './turno-em-curso';

const m = (h: number, min = 0) => h * 60 + min;
// Novembro: Lisboa = UTC, por isso a hora UTC é a hora do hospital.
const utc = (dia: number, h: number, min = 0) => new Date(Date.UTC(2026, 10, dia, h, min));

describe('turnos — a definição única (UX-12)', () => {
  it('horas de serviço: manhã 08–16, tarde 16–24, noite 00–08', () => {
    expect([7, 8, 15, 16, 23, 0].map(turnoDaHora)).toEqual(['noite', 'manha', 'manha', 'tarde', 'tarde', 'noite']);
    expect(rotuloTurnoComHoras('tarde')).toBe('Tarde (16–24)');
    expect(rotuloTurnoComHoras('noite')).toBe('Noite (00–08)');
  });

  it('uma toma das 23:30 é da tarde (no MAR era da noite, na timeline da tarde)', () => {
    expect(turnoDaHora(23)).toBe('tarde');
    expect(turnoDeEscalaEmCurso(m(23, 30)).emCurso).toEqual({ tipo: 'tarde', diasAtras: 0 });
  });

  it('passagem: nos 30 min seguintes ao fim de um turno, quem sai ainda está em passagem', () => {
    expect(turnoDeEscalaEmCurso(m(16, 10))).toEqual({ emCurso: { tipo: 'tarde', diasAtras: 0 }, emPassagem: { tipo: 'manha', diasAtras: 0 } });
    expect(turnoDeEscalaEmCurso(m(0, 20))).toEqual({ emCurso: { tipo: 'noite', diasAtras: 1 }, emPassagem: { tipo: 'tarde', diasAtras: 1 } });
    expect(turnoDeEscalaEmCurso(m(8, 29)).emPassagem).toEqual({ tipo: 'noite', diasAtras: 1 });
    expect(turnoDeEscalaEmCurso(m(16, 30)).emPassagem).toBeNull();
  });

  it('a noite tem a data da véspera na escala', () => {
    const t = turnoEmCurso(utc(20, 2));
    expect(t.tipo).toBe('noite');
    expect(t.dia).toBe('2026-11-19');
    expect(turnoEmCurso(utc(20, 10)).dia).toBe('2026-11-20');
  });

  it('o filtro da escala inclui o turno que sai durante a passagem', () => {
    expect(filtroHorarioTurnoAtivo(utc(20, 16, 5)).OR.map((j) => j.tipo)).toEqual(['tarde', 'manha']);
    expect(filtroHorarioTurnoAtivo(utc(20, 12)).OR.map((j) => j.tipo)).toEqual(['manha']);
  });

  it('prazo de edição: fim do turno + 30 min (manhã 16:30, tarde 00:30, noite 08:30)', () => {
    expect(minutosLimiteEdicao(m(10))).toBe(m(16, 30));
    expect(minutosLimiteEdicao(m(23, 15))).toBe(m(24, 30));
    expect(minutosLimiteEdicao(m(3))).toBe(m(8, 30));
  });
});
