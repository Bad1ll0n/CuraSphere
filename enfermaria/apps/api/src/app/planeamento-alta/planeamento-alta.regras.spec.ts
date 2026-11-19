import { diasAposAltaClinica, estaPendente, sinalizar, transicaoValida } from './planeamento-alta.regras';

describe('planeamento de alta — regras (PROD-13)', () => {
  describe('sinalização precoce', () => {
    const avaliacaoComCuidador = { dados: { cuidadorNome: 'Filha — Ana' } };

    it('Barthel ≤ 60 sinaliza dependência; acima não', () => {
      expect(sinalizar({ barthel: 60, avaliacaoInicial: avaliacaoComCuidador }).map((s) => s.motivo)).toEqual(['dependencia']);
      expect(sinalizar({ barthel: 61, avaliacaoInicial: avaliacaoComCuidador })).toEqual([]);
    });

    it('sem avaliação inicial, ou sem cuidador identificado, sinaliza', () => {
      expect(sinalizar({}).map((s) => s.motivo)).toEqual(['sem_avaliacao_inicial']);
      expect(sinalizar({ avaliacaoInicial: { dados: { cuidadorNome: '  ' } } }).map((s) => s.motivo)).toEqual(['sem_cuidador']);
    });

    it('ensino não compreendido sinaliza — até ser repetido com sucesso (conta o mais recente)', () => {
      const s = sinalizar({ avaliacaoInicial: avaliacaoComCuidador, ensinos: [{ titulo: 'Insulina', compreensao: 'parcial' }] });
      expect(s).toEqual([{ motivo: 'ensino_nao_compreendido', detalhe: 'Ensino a repetir: Insulina' }]);
      const repetido = sinalizar({ avaliacaoInicial: avaliacaoComCuidador, ensinos: [
        { titulo: 'Insulina', compreensao: 'compreendeu' }, { titulo: 'Insulina', compreensao: 'nao_compreendeu' },
      ] });
      expect(repetido).toEqual([]);
    });
  });

  it('transições de estado da referenciação', () => {
    expect(transicaoValida('proposta', 'enviada')).toBe(true);
    expect(transicaoValida('enviada', 'aceite')).toBe(true);
    expect(transicaoValida('aceite', 'vaga_atribuida')).toBe(true);
    expect(transicaoValida('proposta', 'vaga_atribuida')).toBe(false);
    expect(transicaoValida('recusada', 'enviada')).toBe(false);
    expect(transicaoValida('cancelada', 'proposta')).toBe(false);
    expect(['proposta', 'enviada', 'aceite'].every(estaPendente)).toBe(true);
    expect(['vaga_atribuida', 'recusada', 'cancelada'].some(estaPendente)).toBe(false);
  });

  it('dias após a alta clínica', () => {
    const alta = new Date('2026-11-10T15:00:00Z');
    expect(diasAposAltaClinica(null)).toBeNull();
    expect(diasAposAltaClinica(alta, new Date('2026-11-10T20:00:00Z'))).toBe(0);
    expect(diasAposAltaClinica(alta, new Date('2026-11-19T16:00:00Z'))).toBe(9);
  });
});
