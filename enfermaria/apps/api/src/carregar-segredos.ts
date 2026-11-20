import { readFileSync } from 'fs';

/**
 * OPS-20 — segredos a partir de ficheiros (Docker/Kubernetes secrets).
 *
 * Para cada segredo abaixo, se existir `<NOME>_FILE`, o valor lê-se desse ficheiro (por exemplo
 * `/run/secrets/encryption_key`) em vez de vir em claro no `.env` e no ambiente do contentor (onde
 * aparece em `docker inspect` e em qualquer dump de ambiente). Definir os dois é um erro.
 * Corre ANTES de qualquer outro módulo, porque alguns lêem `process.env` ao serem importados.
 */
export const SEGREDOS_POR_FICHEIRO = [
  'DATABASE_URL', 'REDIS_URL',
  'JWT_SECRET', 'JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY',
  'ENCRYPTION_KEY', 'ENCRYPTION_KEYS_ANTERIORES', 'AUDIT_SIGNING_KEY',
  'QUIOSQUE_SECRET', 'MEDICACAO_QR_SECRET', 'METRICS_TOKEN', 'HL7_API_TOKEN',
  'JITSI_APP_SECRET', 'MINIO_SECRET_KEY', 'AWS_SECRET_ACCESS_KEY',
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'RESEND_API_KEY', 'SPMS_API_KEY',
] as const;

export function carregarSegredosDeFicheiro(
  env: NodeJS.ProcessEnv = process.env,
  ler: (caminho: string) => string = (c) => readFileSync(c, 'utf8'),
): string[] {
  const carregados: string[] = [];
  for (const nome of SEGREDOS_POR_FICHEIRO) {
    const ficheiro = env[`${nome}_FILE`];
    if (!ficheiro) continue;
    if (env[nome]) throw new Error(`SEGURANÇA: ${nome} e ${nome}_FILE estão ambos definidos — use só um`);
    let valor: string;
    try {
      valor = ler(ficheiro);
    } catch (e) {
      throw new Error(`SEGURANÇA: não foi possível ler ${nome}_FILE (${ficheiro}): ${(e as Error).message}`);
    }
    env[nome] = valor.trimEnd(); // sem a quebra de linha final (LF ou CRLF — o openssl no Windows escreve CRLF)
    carregados.push(nome);
  }
  return carregados;
}

carregarSegredosDeFicheiro();
