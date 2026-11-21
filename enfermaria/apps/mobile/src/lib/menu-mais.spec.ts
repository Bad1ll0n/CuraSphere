import { REGRAS_ROTA, podeVerRota } from '@org/shared';
import { ROTA_DO_ITEM, itemMaisVisivel, type ItemMais } from './menu-mais';

/** ARQ-24 — o menu "Mais" segue a mesma matriz da web; nenhum item pode apontar para uma rota que não exista nela. */
describe('menu "Mais" (matriz partilhada)', () => {
  it('cada item aponta para uma rota da matriz (ou é universal)', () => {
    for (const [item, rota] of Object.entries(ROTA_DO_ITEM)) {
      if (rota === null) continue;
      expect({ item, existe: rota in REGRAS_ROTA }).toEqual({ item, existe: true });
    }
  });

  it('a visibilidade de cada item é a da rota correspondente', () => {
    const perfis = [
      { role: 'medico' }, { role: 'enfermeiro' }, { role: 'auxiliar' }, { role: 'tecnico_saude' },
      { role: 'farmaceutico' }, { role: 'administrativo', subRole: 'front_desk' },
      { role: 'administrativo', subRole: 'billing_officer' }, { role: 'operacional' },
      { role: 'ti', subRole: 'it_admin' }, { role: 'ti' }, { role: 'qualidade' }, { role: 'direcao' },
    ];
    for (const u of perfis) {
      for (const [item, rota] of Object.entries(ROTA_DO_ITEM) as [ItemMais, string | null][]) {
        expect(itemMaisVisivel(item, u)).toBe(rota === null || podeVerRota(rota, u));
      }
    }
  });

  it('alinhado com a API: o que a API recusa não aparece, o que a API deixa fazer aparece', () => {
    // GET /urgencia/lista não admite o auxiliar; GET /equipamentos admite o enfermeiro e o médico.
    expect(itemMaisVisivel('urgencia', { role: 'auxiliar' })).toBe(false);
    expect(itemMaisVisivel('equipamentos', { role: 'enfermeiro' })).toBe(true);
    // Fisioterapia: @Roles('tecnico_saude') na classe — o médico recebia 403.
    expect(itemMaisVisivel('fisioterapia', { role: 'medico' })).toBe(false);
    // Eventos adversos: qualquer profissional notifica.
    expect(itemMaisVisivel('eventosadversos', { role: 'farmaceutico' })).toBe(true);
    expect(itemMaisVisivel('notificacoes', { role: 'operacional' })).toBe(true);
  });
});
