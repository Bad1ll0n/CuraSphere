import { BadRequestException } from '@nestjs/common';

/**
 * SEC-25 — política de passwords alinhada com o NIST SP 800-63B (rev. 4) e o guia do CNCS.
 *
 * Antes: mínimo de 10, com regras de composição (maiúscula + minúscula + número). Essas regras
 * produzem "Hospital2026" — fácil de adivinhar e aceite — e não travam as mais usadas. E o bcrypt
 * só lê os primeiros 72 bytes: duas passwords longas com o mesmo início eram a mesma.
 *
 * Agora:
 *  - comprimento é o que conta: 12 a 64 caracteres, e no máximo 72 bytes (limite do bcrypt);
 *  - sem regras de composição (frases-passe são bem-vindas);
 *  - recusa as mais comuns e as variantes óbvias ("Hospital2026!", "enfermeiro123");
 *  - recusa as que contêm o número de funcionário, o nome ou o email;
 *  - recusa repetições e sequências ("aaaaaaaaaaaa", "123456789012");
 *  - a nova tem de ser diferente da atual.
 */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 64;
const BYTES_BCRYPT = 72;

// As mais usadas (listas públicas de fugas) e as óbvias neste contexto (hospital, português).
const COMUNS = new Set([
  'password', 'passw0rd', 'palavrapasse', 'palavra-passe', 'senha', 'qwerty', 'qwertyuiop', 'azerty',
  'letmein', 'welcome', 'bemvindo', 'admin', 'administrador', 'iloveyou', 'amoteamo', 'monkey',
  'dragon', 'football', 'futebol', 'benfica', 'sporting', 'porto', 'portugal', 'lisboa', 'coimbra',
  'hospital', 'enfermeiro', 'enfermeira', 'enfermagem', 'medico', 'medica', 'doente', 'saude',
  'curasphere', 'clinica', 'urgencia', 'internamento', 'changeme', 'mudar', 'mudarpassword',
  'teste', 'test', 'trustno1', 'sunshine', 'princess', 'master', 'shadow', 'abc', 'abcdef',
]);

const semAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function eSequenciaOuRepeticao(p: string): boolean {
  if (/^(.)\1+$/.test(p) || /^\d+$/.test(p)) return true; // repetição, ou só dígitos (um PIN longo)
  const codigos = [...p].map((c) => c.charCodeAt(0));
  const asc = codigos.every((c, i) => i === 0 || c === codigos[i - 1] + 1);
  const desc = codigos.every((c, i) => i === 0 || c === codigos[i - 1] - 1);
  return asc || desc;
}

/** Devolve o motivo de recusa, ou `null` se a password é aceitável. */
export function motivoPasswordFraca(
  password: string,
  contexto: { numeroFuncionario?: string; nome?: string; email?: string; atual?: string } = {},
): string | null {
  if (typeof password !== 'string') return 'Indique uma password';
  if ([...password].length < PASSWORD_MIN) return `A password deve ter pelo menos ${PASSWORD_MIN} caracteres (uma frase curta serve)`;
  if ([...password].length > PASSWORD_MAX || Buffer.byteLength(password, 'utf8') > BYTES_BCRYPT) {
    return `A password deve ter no máximo ${PASSWORD_MAX} caracteres (${BYTES_BCRYPT} bytes)`;
  }
  if (contexto.atual !== undefined && password === contexto.atual) return 'A nova password tem de ser diferente da atual';

  const p = semAcentos(password);
  const base = p.replace(/[\d\W_]+$/u, '').replace(/^[\d\W_]+/u, ''); // "Hospital2026!" → "hospital"
  if (COMUNS.has(p) || COMUNS.has(base) || eSequenciaOuRepeticao(p) || (base.length > 0 && eSequenciaOuRepeticao(base) && base.length >= 4)) {
    return 'Essa password é demasiado comum ou previsível — escolha outra (ex.: três palavras sem relação)';
  }

  const pessoais = [
    contexto.numeroFuncionario,
    ...(contexto.nome ? semAcentos(contexto.nome).split(/\s+/) : []),
    contexto.email?.split('@')[0],
  ].filter((x): x is string => !!x && x.length >= 3).map(semAcentos);
  if (pessoais.some((x) => p.includes(x))) return 'A password não pode conter o seu nome, email ou número de funcionário';
  return null;
}

export function exigirPasswordForte(password: string, contexto?: Parameters<typeof motivoPasswordFraca>[1]): void {
  const motivo = motivoPasswordFraca(password, contexto);
  if (motivo) throw new BadRequestException(motivo);
}
