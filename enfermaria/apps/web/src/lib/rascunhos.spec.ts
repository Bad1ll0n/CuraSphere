import { definirUtilizadorRascunhos, gravarRascunho, lerRascunho, limparRascunhos } from './rascunhos';

describe('rascunhos do posto partilhado (UX-21)', () => {
  beforeEach(() => { limparRascunhos('ana'); limparRascunhos('rui'); });

  it('sobrevivem ao fim da sessão e voltam ao mesmo profissional', () => {
    definirUtilizadorRascunhos('ana');
    gravarRascunho('nota-turno:d1', 'Doente com dor torácica às 14h', '');
    definirUtilizadorRascunhos(null); // sessão expirou
    definirUtilizadorRascunhos('ana'); // a Ana volta a entrar
    expect(lerRascunho<string>('nota-turno:d1')).toBe('Doente com dor torácica às 14h');
  });

  it('outro profissional no mesmo posto não os vê', () => {
    definirUtilizadorRascunhos('ana');
    gravarRascunho('nota-turno:d1', 'texto da Ana', '');
    definirUtilizadorRascunhos('rui');
    expect(lerRascunho<string>('nota-turno:d1')).toBeUndefined();
  });

  it('logout explícito apaga; gravar o valor vazio também', () => {
    definirUtilizadorRascunhos('ana');
    gravarRascunho('a', 'x', '');
    gravarRascunho('b', 'y', '');
    gravarRascunho('b', '', '');
    expect(lerRascunho('b')).toBeUndefined();
    limparRascunhos('ana');
    expect(lerRascunho('a')).toBeUndefined();
  });

  it('nunca escreve em localStorage', () => {
    localStorage.clear();
    definirUtilizadorRascunhos('ana');
    gravarRascunho('nota-turno:d1', 'dados clínicos', '');
    expect(localStorage.length).toBe(0);
  });
});
