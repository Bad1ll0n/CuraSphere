import { compararComAlergenio, detetarConflitoAlergia, tokenizar } from './alergias.helper';

describe('alergias.helper', () => {
  const tipo = (med: string, alergenio: string) => compararComAlergenio(med, alergenio)?.tipo ?? null;

  describe('tokenizar()', () => {
    it('descarta doses, unidades e palavras vazias', () => {
      expect(tokenizar('Paracetamol 1g comprimido oral')).toEqual(['paracetamol']);
      expect(tokenizar('Ácido acetilsalicílico 100 mg')).toEqual(['acetilsalicilico']);
    });

    it('normaliza acentuação', () => {
      expect(tokenizar('Codeína')).toEqual(['codeina']);
    });
  });

  // ── QA-07: os casos que o algoritmo por substring falhava ────────────────

  describe('alergénios curtos (o defeito do "mais de 3 caracteres")', () => {
    it('AAS bloqueia AAS', () => {
      expect(tipo('AAS 100mg', 'AAS')).toBe('substancia');
    });

    it('alergia a AAS apanha aspirina e outros AINEs (mesma classe)', () => {
      expect(tipo('Aspirina 100mg', 'AAS')).toBeTruthy();
      expect(tipo('Ibuprofeno 400mg', 'AAS')).toBe('classe');
    });

    it('alergia a ovo apanha propofol (lecitina de ovo)', () => {
      expect(tipo('Propofol 1%', 'ovo')).toBe('classe');
    });
  });

  describe('penicilinas ↔ derivados (o defeito do substring)', () => {
    it('alergia a penicilina bloqueia amoxicilina', () => {
      const r = compararComAlergenio('Amoxicilina 500mg', 'Penicilina');
      expect(r?.tipo).toBe('classe');
      expect(r?.classe).toBe('penicilinas');
    });

    it('alergia a penicilina bloqueia flucloxacilina e piperacilina', () => {
      expect(tipo('Flucloxacilina 1g', 'penicilina')).toBe('classe');
      expect(tipo('Piperacilina/Tazobactam', 'penicilina')).toBe('classe');
    });

    it('alergia a amoxicilina bloqueia ampicilina (mesma classe)', () => {
      expect(tipo('Ampicilina 1g', 'amoxicilina')).toBe('classe');
    });

    it('alergia a penicilina sinaliza cefalosporinas como reactividade cruzada', () => {
      const r = compararComAlergenio('Ceftriaxona 1g', 'penicilina');
      expect(r?.tipo).toBe('cruzada');
      expect(r?.motivo).toMatch(/cruzada/i);
    });
  });

  describe('outras classes', () => {
    it('alergia a "sulfa" apanha cotrimoxazol', () => {
      expect(tipo('Cotrimoxazol 960mg', 'sulfa')).toBe('classe');
    });

    it('alergia a morfina apanha outros opióides', () => {
      expect(tipo('Tramadol 50mg', 'morfina')).toBe('classe');
    });

    it('alergia a iodo apanha contraste iodado', () => {
      expect(tipo('Iohexol', 'iodo')).toBe('classe');
    });

    it('alergia a "AINEs" (designação da classe) apanha diclofenac', () => {
      expect(tipo('Diclofenac 50mg', 'AINEs')).toBe('classe');
    });
  });

  // ── Falsos positivos ─────────────────────────────────────────────────────

  describe('não bloqueia o que não deve', () => {
    it('ácido fólico não colide com ácido acetilsalicílico ("acido" é palavra vazia)', () => {
      expect(tipo('Ácido fólico 5mg', 'Ácido acetilsalicílico')).toBeNull();
    });

    it('fármacos sem relação não correspondem', () => {
      expect(tipo('Paracetamol 1g', 'Penicilina')).toBeNull();
      expect(tipo('Metformina 850mg', 'ovo')).toBeNull();
      expect(tipo('Furosemida 40mg', 'morfina')).toBeNull();
    });

    it('classes distintas sem reactividade cruzada não correspondem', () => {
      expect(tipo('Azitromicina 500mg', 'penicilina')).toBeNull();
      expect(tipo('Ciprofloxacina 500mg', 'sulfa')).toBeNull();
    });

    it('alergénio vazio não corresponde a nada', () => {
      expect(tipo('Paracetamol', '')).toBeNull();
    });
  });

  // ── detetarConflitoAlergia() ─────────────────────────────────────────────

  describe('detetarConflitoAlergia()', () => {
    it('devolve null sem alergias documentadas', () => {
      expect(detetarConflitoAlergia('Amoxicilina', [])).toBeNull();
    });

    it('prioriza a correspondência mais forte (substância antes de cruzada)', () => {
      const conflito = detetarConflitoAlergia('Ceftriaxona 1g', [
        { id: 'a1', alergenio: 'penicilina' },   // cruzada
        { id: 'a2', alergenio: 'ceftriaxona' },  // substância
      ]);
      expect(conflito?.correspondencia.tipo).toBe('substancia');
      expect(conflito?.alergia.id).toBe('a2');
    });

    it('devolve a alergia que motivou o conflito (para registar o override)', () => {
      const conflito = detetarConflitoAlergia('Amoxicilina 500mg', [
        { id: 'a9', alergenio: 'Penicilina', severidade: 'grave' },
      ]);
      expect(conflito?.alergia.id).toBe('a9');
      expect(conflito?.alergia.severidade).toBe('grave');
    });
  });
});
