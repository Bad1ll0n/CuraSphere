import { ordenarParaRegistoRapido } from './prioridade-vitais';

const agora = Date.now();
const ha = (horas: number) => new Date(agora - horas * 3_600_000).toISOString();
const ids = (lista: { id: string }[]) => lista.map((d) => d.id);

describe('ordem do registo rápido de vitais (A7)', () => {
  it('um doente sem NEWS2 não fica abaixo de um doente estável', () => {
    const r = ordenarParaRegistoRapido([
      { id: 'estavel', ultimoNews2: 1, ultimosVitaisEm: ha(2) },
      { id: 'sem-dados', ultimoNews2: null, ultimosVitaisEm: null },
    ]);

    expect(ids(r)).toEqual(['sem-dados', 'estavel']);
  });

  it('o risco alto conhecido vem antes do desconhecido', () => {
    const r = ordenarParaRegistoRapido([
      { id: 'sem-dados', ultimoNews2: null },
      { id: 'alto', ultimoNews2: 5, ultimosVitaisEm: ha(1) },
      { id: 'critico', ultimoNews2: 8, ultimosVitaisEm: ha(1) },
    ]);

    expect(ids(r)).toEqual(['critico', 'alto', 'sem-dados']);
  });

  it('no mesmo grupo, primeiro quem está há mais tempo sem registo', () => {
    const r = ordenarParaRegistoRapido([
      { id: 'recente', ultimoNews2: 2, ultimosVitaisEm: ha(1) },
      { id: 'nunca', ultimoNews2: 2, ultimosVitaisEm: null },
      { id: 'antigo', ultimoNews2: 2, ultimosVitaisEm: ha(6) },
    ]);

    expect(ids(r)).toEqual(['nunca', 'antigo', 'recente']);
  });

  it('não altera a lista original', () => {
    const lista = [{ id: 'a', ultimoNews2: 1 }, { id: 'b', ultimoNews2: 9 }];

    ordenarParaRegistoRapido(lista);

    expect(ids(lista)).toEqual(['a', 'b']);
  });
});
