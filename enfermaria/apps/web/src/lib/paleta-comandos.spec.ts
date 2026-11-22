import { acoesDaFicha, corresponde, doenteDoCaminho, entradasDoMenu, lerRecentes, normalizar, registarRecente } from './paleta-comandos';

describe('paleta de comandos (UX-18)', () => {
  it('pesquisa sem acentos nem maiúsculas, também pelos sinónimos', () => {
    expect(normalizar('Medicação')).toBe('medicacao');
    const nav = entradasDoMenu([{ href: '/risco-clinico', label: 'Risco Clínico' }, { href: '/mar', label: 'MAR' }]);
    expect(nav.filter((e) => corresponde(e, 'vitais')).map((e) => e.href)).toEqual(['/risco-clinico']);
    expect(nav.filter((e) => corresponde(e, 'medicacao')).map((e) => e.href)).toEqual(['/mar']);
  });

  it('a navegação vem só do menu que recebe — sem rotas fixas', () => {
    expect(entradasDoMenu([]).length).toBe(0);
  });

  it('ações da ficha com tecla e separador', () => {
    const id = '7f0c2a52-1d2e-4f6b-9a3d-111111111111';
    expect(doenteDoCaminho(`/doentes/${id}`)).toBe(id);
    expect(doenteDoCaminho('/doentes/admitir')).toBeNull();
    const vitais = acoesDaFicha(id).find((a) => a.tecla === 'V');
    expect(vitais?.href).toBe(`/doentes/${id}#vitais`);
  });

  it('recentes por utilizador, sem repetidos e no máximo 5', () => {
    localStorage.clear();
    for (let i = 0; i < 7; i++) registarRecente('u1', { id: `d${i}`, nome: `Doente ${i}` });
    registarRecente('u1', { id: 'd3', nome: 'Doente 3' });
    expect(lerRecentes('u1').map((d) => d.id)).toEqual(['d3', 'd6', 'd5', 'd4', 'd2']);
    expect(lerRecentes('u2')).toEqual([]);
  });
});
