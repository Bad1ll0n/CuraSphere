import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const KEY_HEX = process.env['ENCRYPTION_KEY'] ?? '';
const KEY = KEY_HEX.length === 64 ? Buffer.from(KEY_HEX, 'hex') : null;

// Fields to encrypt per Prisma model name
const ENCRYPTED_FIELDS: Record<string, string[]> = {
  Doente: ['nome', 'contacto', 'morada'],
  Contacto: ['nome', 'telefone', 'email'],
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
export function criarClienteComEncriptacao(prisma: any) {
  if (!KEY) throw new Error('ENCRYPTION_KEY is required but not configured or invalid');

  return prisma.$extends({
    query: {
      doente: {
        async $allOperations({ operation, args, query }: { operation: string; args: any; query: (a: any) => Promise<any> }) {
          if (['create', 'update', 'upsert'].includes(operation)) {
            encryptData('Doente', args.data);
            if (operation === 'upsert') {
              encryptData('Doente', args.create);
              encryptData('Doente', args.update);
            }
          }
          const result = await query(args);
          return decryptAny('Doente', result);
        },
      },
      contacto: {
        async $allOperations({ operation, args, query }: { operation: string; args: any; query: (a: any) => Promise<any> }) {
          if (['create', 'update', 'upsert'].includes(operation)) {
            encryptData('Contacto', args.data);
            if (operation === 'upsert') {
              encryptData('Contacto', args.create);
              encryptData('Contacto', args.update);
            }
          }
          const result = await query(args);
          return decryptAny('Contacto', result);
        },
      },
    },
  });
}
