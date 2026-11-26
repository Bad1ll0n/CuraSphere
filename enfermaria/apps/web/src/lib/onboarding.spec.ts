import { lerOnboarding, gravarOnboarding, passoFeitoPor, primeirosPassosDoPapel, registarVisita, visitaDoPapel, VISITA_POR_PAPEL } from './onboarding';
import { NOVIDADES } from './novidades';
import pt from '../messages/pt.json';
import en from '../messages/en.json';

describe('onboarding por papel (UX-27)', () => {
  it('cada papel tem a sua visita; quem não tem lista própria recebe a geral, sem "contacte o administrador"', () => {
    expect(visitaDoPapel('farmaceutico').map((p) => p.id)).toContain('farmacia');
    expect(visitaDoPapel('administrativo').map((p) => p.id)).toContain('registos');
    expect(visitaDoPapel('ti').map((p) => p.id)).toEqual(['paleta', 'notificacoes', 'bloquear', 'ajuda']);
  });

  it('todos os passos têm texto em PT e EN', () => {
    const ids = new Set(Object.values(VISITA_POR_PAPEL).flat().map((p) => p.id).concat(['paleta', 'notificacoes', 'bloquear', 'ajuda']));
    for (const id of ids) {
      expect((pt as any).tour.passo[id]?.titulo).toBeTruthy();
      expect((en as any).tour.passo[id]?.texto).toBeTruthy();
    }
    for (const p of ['enfermeiro', 'medico', 'farmaceutico', 'administrativo', 'direcao'].flatMap(primeirosPassosDoPapel)) {
      expect((pt as any).onboarding.primeiro[p.id]).toBeTruthy();
    }
  });

  it('primeiros passos marcam-se ao abrir o ecrã (a ficha conta com qualquer doente)', () => {
    const passos = primeirosPassosDoPapel('enfermeiro');
    let e = lerOnboarding('ninguem');
    e = registarVisita(e, passos, '/mar');
    e = registarVisita(e, passos, '/doentes/7f0c2a52-1d2e-4f6b-9a3d-111111111111');
    expect(e.visitados.sort()).toEqual(['fichaDoente', 'mar']);
    expect(passoFeitoPor({ id: 'fichaDoente', rota: '/doentes/' }, '/doentes')).toBe(false);
    expect(registarVisita(e, passos, '/mar')).toBe(e); // nada de novo, o mesmo objeto
  });

  it('o estado é por utilizador', () => {
    localStorage.clear();
    gravarOnboarding('u1', { visitados: ['mar'], fechado: true, novidadesVistas: NOVIDADES[0].id });
    expect(lerOnboarding('u1').fechado).toBe(true);
    expect(lerOnboarding('u2')).toEqual({ visitados: [], fechado: false, novidadesVistas: null });
  });

  it('novidades com PT e EN, a mais recente primeiro', () => {
    expect(NOVIDADES.every((n) => n.pt.itens.length === n.en.itens.length)).toBe(true);
    expect([...NOVIDADES].sort((a, b) => b.data.localeCompare(a.data))).toEqual(NOVIDADES);
  });
});
