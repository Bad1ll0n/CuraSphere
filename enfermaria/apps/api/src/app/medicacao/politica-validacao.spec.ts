import { modoValidacao, verificarValidacaoFarmaceutica } from './politica-validacao';

const porValidar = { estadoValidacao: null, assinadoEm: new Date(), jaAdministrada: false };
const JUST = 'dor intensa, farmácia fechada';

describe('QA-15 — administração antes da validação farmacêutica', () => {
  it('omissão = primeira_dose; valores desconhecidos também', () => {
    expect(modoValidacao(undefined)).toBe('primeira_dose');
    expect(modoValidacao('qualquer')).toBe('primeira_dose');
    expect(modoValidacao('bloquear')).toBe('bloquear');
    expect(modoValidacao('avisar')).toBe('avisar');
  });

  it.each(['bloquear', 'primeira_dose', 'avisar'] as const)('%s: uma prescrição REJEITADA nunca se administra', (modo) => {
    expect(() => verificarValidacaoFarmaceutica({ ...porValidar, estadoValidacao: 'rejeitada' }, JUST, modo)).toThrow(/^VALIDACAO: a farmácia rejeitou/);
  });

  it.each(['bloquear', 'primeira_dose', 'avisar'] as const)('%s: aprovada administra-se sem justificação', (modo) => {
    expect(verificarValidacaoFarmaceutica({ ...porValidar, estadoValidacao: 'aprovada' }, undefined, modo).justificacaoNaoValidada).toBeNull();
  });

  it('bloquear: por validar não se administra, nem com justificação', () => {
    expect(() => verificarValidacaoFarmaceutica(porValidar, JUST, 'bloquear')).toThrow(/^VALIDACAO:/);
  });

  describe('primeira_dose', () => {
    it('sem justificação → 409 a pedir o porquê', () => {
      expect(() => verificarValidacaoFarmaceutica(porValidar, 'urgente', 'primeira_dose')).toThrow(/justificacaoNaoValidada/);
    });
    it('1.ª dose com justificação → passa e guarda o porquê', () => {
      const r = verificarValidacaoFarmaceutica(porValidar, `  ${JUST}  `, 'primeira_dose');
      expect(r.justificacaoNaoValidada).toBe(JUST);
      expect(r.avisos.join(' ')).toMatch(/antes da validação/);
    });
    it('2.ª dose por validar → bloqueada, mesmo com justificação', () => {
      expect(() => verificarValidacaoFarmaceutica({ ...porValidar, jaAdministrada: true }, JUST, 'primeira_dose')).toThrow(/as seguintes esperam/);
    });
  });

  it('avisar: administra-se e devolve o aviso', () => {
    const r = verificarValidacaoFarmaceutica(porValidar, undefined, 'avisar');
    expect(r.justificacaoNaoValidada).toBeNull();
    expect(r.avisos).toContain('Prescrição ainda não validada pela farmácia.');
  });

  it('falta de assinatura vai no aviso, não bloqueia', () => {
    const r = verificarValidacaoFarmaceutica({ ...porValidar, estadoValidacao: 'aprovada', assinadoEm: null }, undefined, 'bloquear');
    expect(r.avisos).toContain('Prescrição ainda não assinada pelo médico.');
  });
});
