// UX-01 — medicamentos de alto risco (ISMP "high-alert medications"): onde um erro de dose,
// via ou doente tem maior probabilidade de causar dano grave. Na administração pedem uma
// barreira reforçada (confirmação explícita e dupla verificação por outro profissional).

import { CLASSES_FARMACOLOGICAS, tokenizar } from './alergias.helper';
import { expandirMarcas } from './marcas-dci';

const SUBSTANCIAS_ALTO_RISCO = new Set([
  // Insulinas e hipoglicemiantes injectáveis
  'insulina',
  // Anticoagulantes orais e trombolíticos
  'varfarina', 'acenocumarol', 'rivaroxabano', 'apixabano', 'dabigatrano', 'edoxabano',
  'alteplase', 'tenecteplase',
  // Electrólitos concentrados
  'potassio', 'kcl', 'magnesio',
  // Outros
  'metotrexato', 'digoxina', 'amiodarona', 'midazolam', 'propofol', 'noradrenalina',
  'adrenalina', 'dopamina', 'dobutamina',
]);

/** Classes inteiras de alto risco (opióides, heparinas). */
const CLASSES_ALTO_RISCO = new Set(['opioides', 'heparinas']);

/**
 * `true` quando o medicamento (pela substância, pela marca ou pela classe) é de alto risco.
 * Nota: "potássio"/"magnésio" estão nas stopwords do tokenizador de alergias; aqui são
 * procurados no texto normalizado, porque o que importa é o cloreto de potássio concentrado.
 */
export function eAltoRisco(nomeMedicamento: string): boolean {
  const expandido = expandirMarcas(nomeMedicamento);
  const normal = expandido.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const palavras = normal.split(/[^a-z0-9]+/).filter(Boolean);
  if (palavras.some((p) => SUBSTANCIAS_ALTO_RISCO.has(p))) return true;
  const tokens = tokenizar(expandido);
  return CLASSES_FARMACOLOGICAS.some(
    (c) => CLASSES_ALTO_RISCO.has(c.id) && c.membros.some((m) => tokens.some((t) => t === m || (t.length >= 5 && t.startsWith(m)))),
  );
}
