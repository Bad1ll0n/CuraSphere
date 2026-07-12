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
  if (!fields) return;
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

export function aplicarEncriptacaoPrisma(prisma: any): void {
  if (!KEY) throw new Error('ENCRYPTION_KEY is required but not configured or invalid');

  prisma.$use(async (params: any, next: any) => {
    const model: string = params.model ?? '';
    const fields = ENCRYPTED_FIELDS[model];
    if (!fields) return next(params);

    // Encrypt on write
    if (['create', 'update', 'upsert'].includes(params.action)) {
      const data = params.args?.data ?? {};
      encryptData(model, data);
      // upsert has nested create/update
      if (params.action === 'upsert') {
        if (params.args?.create) encryptData(model, params.args.create);
        if (params.args?.update) encryptData(model, params.args.update);
      }
    }

    const result = await next(params);

    // Decrypt on read
    if (result) {
      if (Array.isArray(result)) {
        result.forEach(r => decryptResult(model, r));
      } else {
        decryptResult(model, result);
      }
    }

    return result;
  });
}
