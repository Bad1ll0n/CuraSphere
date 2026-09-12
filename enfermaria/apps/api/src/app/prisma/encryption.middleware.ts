import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

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
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
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
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return text;
  }
}

function encryptData(model: string, data: Record<string, any>): void {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields || !data) return;
  for (const f of fields) {
    if (data[f] && typeof data[f] === 'string') data[f] = encrypt(data[f]);
  }
}

function decryptResult(model: string, result: any): void {
  const fields = ENCRYPTED_FIELDS[model];
  if (!fields || !result || typeof result !== 'object') return;
  for (const f of fields) {
    if (result[f] && typeof result[f] === 'string') result[f] = decrypt(result[f]);
  }
}

function decryptAny(model: string, result: any): any {
  if (Array.isArray(result)) result.forEach((r) => decryptResult(model, r));
  else if (result) decryptResult(model, result);
  return result;
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

  // Os delegates são gerados A PARTIR da configuração, em vez de escritos à mão. Antes,
  // a lista de campos e a lista de delegates eram duas listas independentes que podiam
  // divergir — e divergiram: havia um delegate `contacto` para um modelo inexistente.
  const query: Record<string, any> = {};
  for (const [modelo, delegate] of Object.entries(DELEGATE)) {
    if (!ENCRYPTED_FIELDS[modelo]) continue;
    query[delegate] = {
      async $allOperations({ operation, args, query: executar }: {
        operation: string; args: any; query: (a: any) => Promise<any>;
      }) {
        if (['create', 'update', 'upsert'].includes(operation)) {
          encryptData(modelo, args.data);
          if (operation === 'upsert') {
            encryptData(modelo, args.create);
            encryptData(modelo, args.update);
          }
        }
        if (operation === 'createMany' && Array.isArray(args.data)) {
          args.data.forEach((d: any) => encryptData(modelo, d));
        }
        const resultado = await executar(args);
        return decryptAny(modelo, resultado);
      },
    };
  }

  return prisma.$extends({ query });
}
