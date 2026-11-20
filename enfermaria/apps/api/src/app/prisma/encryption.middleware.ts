import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

const KEY_HEX = process.env['ENCRYPTION_KEY'] ?? '';
const KEY = /^[0-9a-fA-F]{64}$/.test(KEY_HEX) ? Buffer.from(KEY_HEX, 'hex') : null;

/**
 * OPS-20 — rotação da ENCRYPTION_KEY. A chave nova vai para `ENCRYPTION_KEY` e as antigas para
 * `ENCRYPTION_KEYS_ANTERIORES` (separadas por vírgulas): tudo o que foi cifrado com elas continua a
 * ler-se (o AES-GCM diz qual é a chave certa — com outra, a etiqueta de autenticação falha) e a
 * pesquisa por nome e NIF também procura nos índices cegos antigos. Depois corre-se
 * `src/prisma/rodar-chave-cifragem.ts`, que recifra tudo com a chave nova; no fim retiram-se as
 * antigas. Procedimento completo em docs/SEGREDOS.md.
 */
const CHAVES_ANTERIORES: Buffer[] = (process.env['ENCRYPTION_KEYS_ANTERIORES'] ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter((h) => /^[0-9a-fA-F]{64}$/.test(h) && h.toLowerCase() !== KEY_HEX.toLowerCase())
  .map((h) => Buffer.from(h, 'hex'));

/**
 * Campos cifrados em repouso, por modelo Prisma (S-14).
 *
 * A versão anterior desta tabela apontava para um modelo `Contacto` que NÃO EXISTE (o
 * modelo chama-se `ContactoEmergencia`) e para campos `Doente.contacto` e `Doente.morada`
 * que também não existem. Como a cifragem se limitava a ignorar o que não encontrava,
 * falhava em silêncio: na prática protegia exactamente um campo — `Doente.nome` — e o NIF,
 * o número de SNS, a morada, o telefone e os contactos de emergência ficavam em claro,
 * enquanto tudo indicava que estavam protegidos. É o pior modo de falha de um controlo de
 * segurança: o que dá confiança é a configuração, não o efeito.
 *
 * NOTA sobre o que NÃO está aqui: `nif` e `numeroSNS` são usados em consultas de igualdade
 * (verificação de duplicados na admissão, procura FHIR por número de utente). Cifrar com
 * IV aleatório torna dois cifrados do mesmo valor diferentes entre si, logo essas consultas
 * deixariam de encontrar seja o que for. Protegê-los exige um índice cego determinista —
 * ver `INDICES_CEGOS` abaixo.
 */
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  Doente: ['nome'],
  ContactoEmergencia: ['nome', 'telefone'],
  FicheiroPessoalDoente: ['morada', 'telefone', 'email', 'nif'], // SEC-12: o NIF também
};

/** Nome do delegate Prisma (camelCase) para cada modelo cifrado. */
const DELEGATE: Record<string, string> = {
  Doente: 'doente',
  ContactoEmergencia: 'contactoEmergencia',
  FicheiroPessoalDoente: 'ficheiroPessoalDoente',
};

function encrypt(text: string): string {
  if (!KEY || !text) return text;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv, { authTagLength: 16 });
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${Buffer.concat([iv, tag, enc]).toString('base64')}`;
}

/** Decifra com UMA chave; `null` se não for esta (a etiqueta GCM não confere). */
function decifrarCom(chave: Buffer, text: string): string | null {
  try {
    const buf = Buffer.from(text.slice(4), 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', chave, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

function decrypt(text: string): string {
  if (!KEY || !text?.startsWith('enc:')) return text;
  for (const chave of [KEY, ...CHAVES_ANTERIORES]) {
    const claro = decifrarCom(chave, text);
    if (claro !== null) return claro;
  }
  return text;
}

/**
 * OPS-20 — para a rotação: se `valor` está cifrado com uma chave ANTERIOR, devolve o texto em
 * claro (para ser recifrado com a atual); `null` se já está com a atual, em claro, ou ilegível.
 */
export function claroSeChaveAntiga(valor: unknown): string | null {
  if (!KEY || typeof valor !== 'string' || !valor.startsWith('enc:')) return null;
  if (decifrarCom(KEY, valor) !== null) return null;
  for (const chave of CHAVES_ANTERIORES) {
    const claro = decifrarCom(chave, valor);
    if (claro !== null) return claro;
  }
  return null;
}

function encryptData(model: string, data: Record<string, any>): void {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields || !data || typeof data !== 'object') return;
  // Índice cego do nome (QA-05): calculado a partir do valor EM CLARO, antes de cifrar.
  if (model === 'Doente' && typeof data['nome'] === 'string' && !data['nome'].startsWith('enc:')) {
    data['nomeBusca'] = tokensDeBuscaNome(data['nome']);
  }
  // SEC-12: índice cego do NIF (igualdade exata), calculado do valor em claro.
  if (model === 'FicheiroPessoalDoente' && typeof data['nif'] === 'string' && !data['nif'].startsWith('enc:')) {
    data['nifBusca'] = indiceNif(data['nif']);
  }
  for (const f of fields) {
    // Um valor já cifrado não se cifra outra vez (ex.: recifragem de linhas antigas).
    if (data[f] && typeof data[f] === 'string' && !data[f].startsWith('enc:')) data[f] = encrypt(data[f]);
  }
}

/* ------------------------------------------------------------------ *
 * Decifragem em profundidade (QA-04)
 *
 * `include`/`select` de relações devolviam os campos cifrados tal e qual: o farmacêutico via
 * `enc:Xwv+…` em vez do nome do doente da prescrição que validava. A decifragem segue agora
 * as relações — mas só as que podem chegar a um modelo cifrado, calculadas uma vez a partir
 * do modelo de dados do Prisma, para não percorrer resultados que nunca têm PII.
 * ------------------------------------------------------------------ */

/** Por modelo: relações cujo modelo de destino tem (ou leva a) campos cifrados. */
let RELACOES_COM_PII: Record<string, { campo: string; modelo: string }[]> = {};

function calcularRelacoesComPii(modelos: Record<string, any> | undefined): void {
  const relacoes: Record<string, { campo: string; modelo: string }[]> = {};
  for (const [nome, def] of Object.entries(modelos ?? {})) {
    relacoes[nome] = ((def as any).fields ?? [])
      .filter((f: any) => f.kind === 'object')
      .map((f: any) => ({ campo: f.name, modelo: f.type }));
  }
  // Ponto fixo: um modelo "leva a PII" se é cifrado ou se alguma das suas relações leva.
  const levaAPii = new Set(Object.keys(ENCRYPTED_FIELDS));
  for (let mudou = true; mudou; ) {
    mudou = false;
    for (const [nome, rels] of Object.entries(relacoes)) {
      if (!levaAPii.has(nome) && rels.some((r) => levaAPii.has(r.modelo))) {
        levaAPii.add(nome);
        mudou = true;
      }
    }
  }
  RELACOES_COM_PII = Object.fromEntries(
    Object.entries(relacoes).map(([nome, rels]) => [nome, rels.filter((r) => levaAPii.has(r.modelo))]),
  );
}

function decryptDeep(model: string, result: any, vistos = new Set<object>()): void {
  if (!result || typeof result !== 'object' || vistos.has(result)) return;
  if (Array.isArray(result)) {
    result.forEach((r) => decryptDeep(model, r, vistos));
    return;
  }
  vistos.add(result);
  for (const f of ENCRYPTED_FIELDS[model] ?? []) {
    if (result[f] && typeof result[f] === 'string') result[f] = decrypt(result[f]);
  }
  for (const rel of RELACOES_COM_PII[model] ?? []) {
    if (result[rel.campo]) decryptDeep(rel.modelo, result[rel.campo], vistos);
  }
}

function decryptAny(model: string, result: any): any {
  decryptDeep(model, result);
  return result;
}

/**
 * PERF-16 — decifrar uma lista grande sem prender o event loop. A decifragem é síncrona (AES-GCM
 * por campo, mais o percurso das relações): numa exportação ou num relatório com milhares de
 * linhas, a API deixava de responder a todos os outros pedidos — incluindo os alertas clínicos em
 * tempo real — até acabar. Por lotes, com uma pausa (setImmediate) entre eles, os outros pedidos
 * são servidos pelo meio. Listas pequenas (o normal) decifram-se de uma vez, como antes.
 */
export const LOTE_DECIFRAGEM = 200;
export async function decifrarSemBloquear(model: string, result: any, lote = LOTE_DECIFRAGEM): Promise<any> {
  if (!Array.isArray(result) || result.length <= lote) return decryptAny(model, result);
  for (let i = 0; i < result.length; i += lote) {
    for (let j = i; j < Math.min(i + lote, result.length); j++) decryptDeep(model, result[j]);
    if (i + lote < result.length) await new Promise<void>((ok) => setImmediate(ok));
  }
  return result;
}

/* ------------------------------------------------------------------ *
 * Índice cego para pesquisa por nome (QA-05)
 *
 * O nome está cifrado com IV aleatório, por isso `nome contains 'Zulmira'` nunca encontrava
 * nada e a receção não achava doentes pelo nome. Guarda-se ao lado, em `Doente.nomeBusca`,
 * uma lista de tokens HMAC de cada palavra normalizada (minúsculas, sem acentos) e dos seus
 * prefixos com 3+ letras. Pesquisar "zulm" calcula o mesmo HMAC e procura-o na lista, sem o
 * nome nunca existir em claro na BD. A chave do HMAC é derivada (não é a ENCRYPTION_KEY) e
 * o índice só revela igualdade de tokens — o compromisso habitual de um índice cego.
 * ------------------------------------------------------------------ */

const derivarBusca = (k: Buffer) => createHmac('sha256', k).update('curasphere:indice-cego:nome:v1').digest();
const CHAVE_BUSCA = KEY ? derivarBusca(KEY) : null;
/** OPS-20: durante a rotação, a pesquisa também procura nos índices calculados com as chaves antigas. */
const CHAVES_BUSCA_ANTERIORES = CHAVES_ANTERIORES.map(derivarBusca);

function normalizar(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 0);
}

function tokenBusca(parte: string, chave: Buffer = CHAVE_BUSCA as Buffer): string {
  return createHmac('sha256', chave).update(parte).digest('hex').slice(0, 16);
}

/**
 * SEC-11 — segredos que o servidor tem de voltar a ler (semente TOTP, segredo de webhook) ficam
 * cifrados em repouso com a ENCRYPTION_KEY. Não passam pela cifragem automática por modelo (o
 * `Utilizador` está ligado a quase tudo e a decifragem em profundidade correria em cada leitura):
 * cifra-se e decifra-se onde se escreve e lê. Um valor antigo em claro continua a ler-se.
 */
export function cifrarSegredo(valor: string): string;
export function cifrarSegredo(valor: string | null): string | null;
export function cifrarSegredo(valor: string | null): string | null {
  if (valor == null || valor.startsWith('enc:')) return valor;
  return encrypt(valor);
}
export function decifrarSegredo(valor: string): string;
export function decifrarSegredo(valor: string | null): string | null;
export function decifrarSegredo(valor: string | null): string | null {
  return valor == null ? null : decrypt(valor);
}

/**
 * SEC-12 — índice cego do NIF: HMAC (chave derivada, própria do NIF) dos 9 dígitos. Só revela
 * igualdade. Sem ENCRYPTION_KEY (desenvolvimento) não há cifragem, e procura-se o NIF em claro.
 */
const derivarNif = (k: Buffer) => createHmac('sha256', k).update('curasphere:indice-cego:nif:v1').digest();
const CHAVE_NIF = KEY ? derivarNif(KEY) : null;
const CHAVES_NIF_ANTERIORES = CHAVES_ANTERIORES.map(derivarNif);

export function indiceNif(nif: string, chave: Buffer | null = CHAVE_NIF): string | null {
  const digitos = String(nif).replace(/\D/g, '');
  if (!chave || !digitos) return null;
  return createHmac('sha256', chave).update(digitos).digest('hex');
}

/** Filtro Prisma para encontrar uma ficha pelo NIF (no índice cego, ou em claro sem chave). */
export function filtroNif(nif: string): Record<string, unknown> {
  const indice = indiceNif(nif);
  if (!indice) return { nif: String(nif).replace(/\D/g, '') };
  if (CHAVES_NIF_ANTERIORES.length === 0) return { nifBusca: indice };
  return { nifBusca: { in: [indice, ...CHAVES_NIF_ANTERIORES.map((k) => indiceNif(nif, k) as string)] } };
}

/** Tokens de busca de um nome em claro, como ` t1 t2 … ` (espaços nas pontas para `contains` exato). */
export function tokensDeBuscaNome(nome: string): string | null {
  if (!CHAVE_BUSCA || !nome) return null;
  const tokens = new Set<string>();
  for (const palavra of normalizar(nome)) {
    if (palavra.length < 3) tokens.add(tokenBusca(palavra));
    for (let n = 3; n <= palavra.length; n++) tokens.add(tokenBusca(palavra.slice(0, n)));
  }
  return tokens.size ? ` ${[...tokens].join(' ')} ` : null;
}

/**
 * Filtro Prisma para pesquisar doentes por nome no índice cego: todas as palavras da
 * pesquisa têm de aparecer no nome (como palavra inteira ou como início de palavra).
 */
export function filtroPesquisaNome(pesquisa: string): Record<string, unknown> | null {
  if (!CHAVE_BUSCA) return null;
  const palavras = normalizar(pesquisa);
  if (palavras.length === 0) return null;
  const comChave = (k: Buffer) => ({ AND: palavras.map((p) => ({ nomeBusca: { contains: ` ${tokenBusca(p, k)} ` } })) });
  if (CHAVES_BUSCA_ANTERIORES.length === 0) return comChave(CHAVE_BUSCA);
  return { OR: [CHAVE_BUSCA, ...CHAVES_BUSCA_ANTERIORES].map(comChave) };
}

// Prisma 7 removed the `$use` middleware API this used to run on ($use was
// deprecated in Prisma 4.16 and dropped entirely by 7 — calling it throws
// `prisma.$use is not a function` and crashes the app at boot, since
// PrismaService's constructor calls this unconditionally). Migrated to the
// Client Extensions API (`$extends`): returns an extended client whose
// `doente`/`contacto` model delegates encrypt on write and decrypt on read;
// every other model delegate is untouched. PrismaService exposes this via
// getters so `this.prisma.doente...` call sites elsewhere in the app don't change.
/**
 * Confirma que cada modelo e cada campo declarado existe mesmo no cliente Prisma.
 *
 * É esta verificação que faltava. Sem ela, um nome errado na tabela acima não produz
 * erro nenhum — produz apenas ausência de cifragem, que é indistinguível de tudo estar
 * bem. Preferimos que a aplicação recuse arrancar: uma configuração de segurança que
 * aponta para o que não existe é um defeito, não uma opção.
 */
function validarConfiguracao(prisma: any): void {
  const modelos = prisma?._runtimeDataModel?.models;
  const problemas: string[] = [];

  for (const [modelo, campos] of Object.entries(ENCRYPTED_FIELDS)) {
    const delegate = DELEGATE[modelo];
    if (!delegate || !prisma[delegate]) {
      problemas.push(`modelo '${modelo}' não existe no cliente Prisma`);
      continue;
    }
    // O modelo de dados em runtime nem sempre está exposto; quando está, confirma-se
    // campo a campo. Quando não está, fica a verificação do delegate, que já apanha o
    // erro mais comum (nome de modelo errado).
    const declarados = modelos?.[modelo]?.fields?.map((f: any) => f.name);
    if (!declarados) continue;
    for (const campo of campos) {
      if (!declarados.includes(campo)) {
        problemas.push(`campo '${modelo}.${campo}' não existe`);
      }
    }
  }

  if (problemas.length > 0) {
    throw new Error(
      'Configuração de cifragem inválida — os seguintes campos NÃO estariam protegidos: ' +
        problemas.join('; '),
    );
  }
}
export function criarClienteComEncriptacao(prisma: any) {
  if (!KEY) throw new Error('ENCRYPTION_KEY is required but not configured or invalid');

  validarConfiguracao(prisma);
  calcularRelacoesComPii(prisma?._runtimeDataModel?.models);

  // Um só handler para todos os modelos: cifra nas escritas dos modelos cifrados e decifra
  // em profundidade as leituras de QUALQUER modelo — uma medicação com `include: { doente }`
  // também traz o nome do doente, e era aí que ele chegava ao ecrã como `enc:…`.
  const query = {
    $allModels: {
      async $allOperations({ model, operation, args, query: executar }: {
        model: string; operation: string; args: any; query: (a: any) => Promise<any>;
      }) {
        if (ENCRYPTED_FIELDS[model]) {
          if (['create', 'update', 'updateMany', 'upsert'].includes(operation)) {
            encryptData(model, args.data);
            if (operation === 'upsert') {
              encryptData(model, args.create);
              encryptData(model, args.update);
            }
          }
          if ((operation === 'createMany' || operation === 'createManyAndReturn') && Array.isArray(args.data)) {
            args.data.forEach((d: any) => encryptData(model, d));
          }
        }
        const resultado = await executar(args);
        return decifrarSemBloquear(model, resultado);
      },
    },
  };

  return prisma.$extends({ query });
}

/** Delegates de todos os modelos do cliente (camelCase), para o `PrismaService` os trocar. */
export function delegatesDoCliente(prisma: any): string[] {
  const modelos = Object.keys(prisma?._runtimeDataModel?.models ?? {});
  return modelos.map((m) => m.charAt(0).toLowerCase() + m.slice(1));
}
