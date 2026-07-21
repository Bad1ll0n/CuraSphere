import { TransfusaoService } from './transfusao.service';

/**
 * Segurança transfusional ABO/Rh — testa a função pura de compatibilidade (a barreira que
 * impede administrar sangue incompatível). Determinístico, sem BD.
 */
describe('TransfusaoService.verificarCompatibilidade', () => {
  // A função não usa dependências — instanciamos com nulls.
  const svc = new TransfusaoService(null as any, null as any);
  const compat = (comp: string, dABO: string | null, dRh: string | null, bABO: string, bRh: string) =>
    svc.verificarCompatibilidade(comp, dABO, dRh, bABO, bRh).compativel;

  describe('eritrócitos (concentrado_eritrocitos)', () => {
    const C = 'concentrado_eritrocitos';

    it('O- é dador universal — compatível com qualquer recetor', () => {
      for (const abo of ['A', 'B', 'AB', 'O']) {
        for (const rh of ['positivo', 'negativo']) {
          expect(compat(C, abo, rh, 'O', 'negativo')).toBe(true);
        }
      }
    });

    it('AB+ recebe de qualquer grupo ABO (recetor universal de eritrócitos)', () => {
      for (const abo of ['A', 'B', 'AB', 'O']) {
        expect(compat(C, 'AB', 'positivo', abo, 'positivo')).toBe(true);
      }
    });

    it('doente O NÃO pode receber A/B/AB (incompatibilidade ABO)', () => {
      expect(compat(C, 'O', 'positivo', 'A', 'positivo')).toBe(false);
      expect(compat(C, 'O', 'positivo', 'B', 'positivo')).toBe(false);
      expect(compat(C, 'O', 'positivo', 'AB', 'positivo')).toBe(false);
    });

    it('doente Rh- NÃO pode receber Rh+', () => {
      expect(compat(C, 'O', 'negativo', 'O', 'positivo')).toBe(false);
      expect(compat(C, 'A', 'negativo', 'A', 'positivo')).toBe(false);
    });

    it('doente Rh+ pode receber Rh- e Rh+ do mesmo ABO', () => {
      expect(compat(C, 'A', 'positivo', 'A', 'negativo')).toBe(true);
      expect(compat(C, 'A', 'positivo', 'A', 'positivo')).toBe(true);
    });

    it('grupo do doente por determinar → só dador universal O Rh-', () => {
      expect(compat(C, null, null, 'O', 'negativo')).toBe(true);
      expect(compat(C, null, null, 'O', 'positivo')).toBe(false);
      expect(compat(C, null, null, 'A', 'negativo')).toBe(false);
    });
  });

  describe('plasma (plasma_fresco_congelado) — compatibilidade ABO invertida', () => {
    const P = 'plasma_fresco_congelado';

    it('AB é dador universal de plasma', () => {
      for (const abo of ['A', 'B', 'AB', 'O']) {
        expect(compat(P, abo, 'positivo', 'AB', 'positivo')).toBe(true);
      }
    });

    it('doente O é recetor universal de plasma (recebe de qualquer grupo ABO)', () => {
      for (const abo of ['A', 'B', 'AB', 'O']) {
        expect(compat(P, 'O', 'positivo', abo, 'positivo')).toBe(true);
      }
    });

    it('doente AB só recebe plasma AB', () => {
      expect(compat(P, 'AB', 'positivo', 'AB', 'positivo')).toBe(true);
      expect(compat(P, 'AB', 'positivo', 'A', 'positivo')).toBe(false);
      expect(compat(P, 'AB', 'positivo', 'O', 'positivo')).toBe(false);
    });

    it('grupo por determinar → plasma só AB', () => {
      expect(compat(P, null, null, 'AB', 'positivo')).toBe(true);
      expect(compat(P, null, null, 'O', 'positivo')).toBe(false);
    });
  });
});
