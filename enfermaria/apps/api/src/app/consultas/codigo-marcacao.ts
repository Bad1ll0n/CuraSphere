import { randomInt } from 'crypto';

/**
 * Código que o doente leva para o quiosque (S-13).
 *
 * Era `CON-` + 4 caracteres de `Math.random()`: cerca de um milhão de combinações, de um
 * gerador não criptográfico, a servir de única chave de pesquisa num quiosque que devolve o
 * nome e o número de processo do doente. Com uma centena de marcações activas, cerca de uma
 * tentativa em cada dez mil acertava num doente.
 *
 * Passa a ter 8 caracteres de `randomInt` (32^8 ≈ 1,1 × 10^12), em dois grupos para se
 * escrever sem erros num ecrã táctil. O alfabeto continua sem 0/O e 1/I.
 */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const grupo = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

export function gerarCodigoMarcacao(): string {
  return `CON-${grupo()}-${grupo()}`;
}

/**
 * Normaliza o que foi escrito no quiosque: maiúsculas, com ou sem espaços e hífens, com ou
 * sem o prefixo. Aceita também o formato antigo de 4 caracteres, para as marcações que já
 * foram emitidas. Devolve `null` para o que não pode ser um código, sem ir à base de dados.
 *
 * O prefixo reconhece-se sem ambiguidade porque o alfabeto não tem `O`: nenhum código pode
 * começar por "CON" sem que isso seja o prefixo.
 */
export function normalizarCodigoMarcacao(entrada: string | undefined | null): string | null {
  if (!entrada || entrada.length > 32) return null;
  const limpo = entrada.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const corpo = limpo.startsWith('CON') ? limpo.slice(3) : limpo;

  if (corpo.length === 8) return `CON-${corpo.slice(0, 4)}-${corpo.slice(4)}`;
  if (corpo.length === 4) return `CON-${corpo}`;
  return null;
}
