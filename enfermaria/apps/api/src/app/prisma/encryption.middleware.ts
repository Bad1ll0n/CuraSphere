import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

const KEY_HEX = process.env['ENCRYPTION_KEY'] ?? '';
const KEY = KEY_HEX.length === 64 ? Buffer.from(KEY_HEX, 'hex') : null;

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
  FicheiroPessoalDoente: ['morada', 'telefone', 'email'],
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

function decrypt(text: string): string {
  if (!KEY || !text?.startsWith('enc:')) return text;
  try {
    const buf = Buffer.from(text.slice(4), 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return text;
  }
}

function encryptData(model: string, data: Record<string, any>): void {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields || !data || typeof data !== 'object') return;
  // Índice cego do nome (QA-05): calculado a partir do valor EM CLARO, antes de cifrar.
  if (model === 'Doente' && typeof data['nome'] === 'string' && !data['nome'].startsWith('enc:')) {
    data['nomeBusca'] = tokensDeBuscaNome(data['nome']);
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

const CHAVE_BUSCA = KEY ? createHmac('sha256', KEY).update('curasphere:indice-cego:nome:v1').digest() : null;

function normalizar(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 0);
}

function tokenBusca(parte: string): string {
  return createHmac('sha256', CHAVE_BUSCA as Buffer).update(parte).digest('hex').slice(0, 16);
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
  return { AND: palavras.map((p) => ({ nomeBusca: { contains: ` ${tokenBusca(p)} ` } })) };
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
        return decryptAny(model, resultado);
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
