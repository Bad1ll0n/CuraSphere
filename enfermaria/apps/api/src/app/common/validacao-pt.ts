import { BadRequestException, ValidationError } from '@nestjs/common';

/**
 * QA-17: as mensagens por omissão do `class-validator` chegavam à UI em inglês
 * ("pressaoSistolica must not be less than 0", "property password should not exist").
 *
 * Em vez de pôr `message` em ~1500 decorators, a `ValidationPipe` global usa esta
 * `exceptionFactory`: traduz para PT-PT as mensagens por omissão, reconhecidas pelo
 * modelo de texto do próprio class-validator. Uma mensagem personalizada (já escrita
 * num decorator) não corresponde a nenhum modelo e passa intacta.
 *
 * O formato da resposta não muda: `BadRequestException` com uma lista de strings, e
 * os erros aninhados com o caminho `pai.0.filho`, como a pipe fazia.
 */

type Traducao = [RegExp, (campo: string, m: RegExpMatchArray) => string];

// Cada modelo começa depois de "<campo> " — o campo é tratado à parte, porque pode trazer
// o prefixo "each value in" (decorators com `each: true`).
const MODELOS: Traducao[] = [
  [/^must not be less than (.+)$/, (c, m) => `${c} não pode ser inferior a ${m[1]}`],
  [/^must not be greater than (.+)$/, (c, m) => `${c} não pode ser superior a ${m[1]}`],
  [/^must be shorter than or equal to (\d+) characters$/, (c, m) => `${c} não pode ter mais de ${m[1]} caracteres`],
  [/^must be longer than or equal to (\d+) characters$/, (c, m) => `${c} tem de ter pelo menos ${m[1]} caracteres`],
  [/^should not be empty$/, (c) => `${c} é obrigatório`],
  [/^must be a string$/, (c) => `${c} tem de ser texto`],
  [/^must be a number conforming to the specified constraints$/, (c) => `${c} tem de ser um número`],
  [/^must be an integer number$/, (c) => `${c} tem de ser um número inteiro`],
  [/^must be a positive number$/, (c) => `${c} tem de ser um número positivo`],
  [/^must be a negative number$/, (c) => `${c} tem de ser um número negativo`],
  [/^must be a boolean value$/, (c) => `${c} tem de ser verdadeiro ou falso`],
  [/^must be a valid ISO 8601 date string$/, (c) => `${c} tem de ser uma data válida (ISO 8601)`],
  [/^must be a Date instance$/, (c) => `${c} tem de ser uma data válida`],
  [/^must be one of the following values: (.*)$/, (c, m) => `${c} tem de ser um dos valores: ${m[1]}`],
  [/^must be a valid enum value$/, (c) => `${c} tem um valor não permitido`],
  [/^must be an object$/, (c) => `${c} tem de ser um objeto`],
  [/^must be an array$/, (c) => `${c} tem de ser uma lista`],
  [/^must be a UUID$/, (c) => `${c} tem de ser um identificador válido (UUID)`],
  [/^must be an email$/, (c) => `${c} tem de ser um email válido`],
  [/^must be a URL address$/, (c) => `${c} tem de ser um endereço URL válido`],
  [/^must match (.+) regular expression$/, (c) => `${c} não tem o formato esperado`],
  [/^must contain no more than (\d+) elements$/, (c, m) => `${c} não pode ter mais de ${m[1]} elementos`],
  [/^must contain at least (\d+) elements$/, (c, m) => `${c} tem de ter pelo menos ${m[1]} elementos`],
  [/^should not be null or undefined$/, (c) => `${c} é obrigatório`],
  [/^must be either object or array$/, (c) => `${c} tem de ser um objeto ou uma lista`],
];

export function traduzirMensagemValidacao(mensagem: string, propriedade: string): string {
  // "property X should not exist" (whitelist + forbidNonWhitelisted)
  const naoPermitido = /^property (.+) should not exist$/.exec(mensagem);
  if (naoPermitido) return `O campo ${naoPermitido[1]} não é permitido`;

  // "nested property X must be either object or array"
  let resto = mensagem;
  let campo: string;
  if (resto.startsWith('nested property ')) resto = resto.slice('nested property '.length);
  if (resto.startsWith(`each value in ${propriedade} `)) {
    campo = `Cada valor de ${propriedade}`;
    resto = resto.slice(`each value in ${propriedade} `.length);
  } else if (resto.startsWith(`${propriedade} `)) {
    campo = propriedade;
    resto = resto.slice(propriedade.length + 1);
  } else {
    return mensagem; // mensagem personalizada — já vem em PT
  }
  for (const [re, traduzir] of MODELOS) {
    const m = resto.match(re);
    if (m) return traduzir(campo, m);
  }
  return mensagem;
}

/** Achata a árvore de erros como a `ValidationPipe` (caminho `pai.0.filho`) e traduz. */
export function mensagensValidacao(erros: ValidationError[], prefixo = ''): string[] {
  const saida: string[] = [];
  for (const erro of erros) {
    const caminho = prefixo ? `${prefixo}.${erro.property}` : erro.property;
    for (const mensagem of Object.values(erro.constraints ?? {})) {
      const traduzida = traduzirMensagemValidacao(mensagem, erro.property);
      // O class-validator põe só o nome da propriedade; nos aninhados acrescenta-se o caminho.
      saida.push(prefixo && traduzida !== mensagem ? traduzida.replace(erro.property, caminho) : traduzida);
    }
    if (erro.children?.length) saida.push(...mensagensValidacao(erro.children, caminho));
  }
  return saida;
}

export function excecaoValidacao(erros: ValidationError[]): BadRequestException {
  return new BadRequestException(mensagensValidacao(erros));
}
