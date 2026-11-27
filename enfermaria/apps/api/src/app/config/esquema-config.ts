import * as Joi from 'joi';
import { erroOrigens } from '../common/seguranca/origens-permitidas';

/**
 * ARQ-20 — validação da configuração no arranque, completa e fechada em produção.
 *
 * O esquema antigo validava cinco variáveis. O resto falhava aberto: a `AUDIT_SIGNING_KEY` em falta
 * caía numa chave PÚBLICA (só um log de erro), uma `ENCRYPTION_KEY` com 128 hex passava no Joi
 * (`min(64)`) mas desligava a cifragem em silêncio (o código só aceita 64), o segredo das etiquetas
 * de medicação reutilizava o JWT_SECRET, e um valor de exemplo do `.env.example` ("ALTERAR…")
 * arrancava em produção. Agora a API recusa arrancar.
 */

/** Segredos que nunca podem ser iguais entre si nem um valor de exemplo (em produção). */
export const SEGREDOS = [
  'JWT_SECRET', 'ENCRYPTION_KEY', 'AUDIT_SIGNING_KEY', 'QUIOSQUE_SECRET',
  'MEDICACAO_QR_SECRET', 'METRICS_TOKEN', 'HL7_API_TOKEN',
] as const;

const VALOR_DE_EXEMPLO = /ALTERAR|CHANGE_?ME|substitui|placeholder|exemplo|example|insecure|dev-insecure/i;
const HEX64 = /^[0-9a-fA-F]{64}$/;

const producao = (regra: Joi.Schema, fora: Joi.Schema = Joi.any()) =>
  Joi.when('NODE_ENV', { is: 'production', then: regra, otherwise: fora });
/** Opcional (o compose passa `""` quando não está definido), mas forte quando existe em produção. */
const opcionalForte = (min: number) =>
  producao(Joi.string().min(min).allow(''), Joi.string().allow('')).optional();

export const esquemaConfiguracao = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3333),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  ALLOWED_ORIGINS: producao(Joi.string().required(), Joi.string().allow('').optional()),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().pattern(/^\d+[smhd]$/).default('15m'),
  // SEC-11: em produção, ES256 (o par é validado em chaves-jwt.ts).
  JWT_PRIVATE_KEY: producao(Joi.string().required(), Joi.string().allow('').optional()),
  JWT_PUBLIC_KEY: producao(Joi.string().required(), Joi.string().allow('').optional()),

  // Exatamente 64 hex: com outro tamanho o código desligava a cifragem sem dizer nada.
  ENCRYPTION_KEY: Joi.string().pattern(HEX64, '64 caracteres hexadecimais').required(),
  // OPS-20: chaves anteriores, só para ler durante a rotação.
  ENCRYPTION_KEYS_ANTERIORES: Joi.string().pattern(/^[0-9a-fA-F]{64}(,[0-9a-fA-F]{64})*$/, 'lista de chaves de 64 hex').allow('').optional(),

  AUDIT_SIGNING_KEY: producao(Joi.string().min(32).required(), Joi.string().allow('').optional()),
  MEDICACAO_QR_SECRET: producao(Joi.string().min(32).required(), Joi.string().allow('').optional()),
  QUIOSQUE_SECRET: opcionalForte(32),
  METRICS_TOKEN: opcionalForte(24),
  HL7_API_TOKEN: opcionalForte(32),
  // QA-15: um erro de escrita caía em silêncio no modo por omissão — aqui recusa-se no arranque.
  VALIDACAO_ANTES_DE_ADMINISTRAR: Joi.string().valid('bloquear', 'primeira_dose', 'avisar').optional(),
  // SEC-22: de onde o motor HL7 pode chamar (IPs/CIDR). Obrigatório em produção se o HL7 estiver ligado.
  HL7_ORIGENS_PERMITIDAS: Joi.string().allow('').optional().custom((v: string, h) => {
    const erro = erroOrigens(v);
    return erro ? h.message({ custom: `HL7_ORIGENS_PERMITIDAS: ${erro}` }) : v;
  }),
})
  .custom((valores: Record<string, unknown>, helpers) => {
    if (valores['NODE_ENV'] !== 'production') return valores;
    const vistos = new Map<string, string>();
    for (const nome of SEGREDOS) {
      const v = valores[nome];
      if (typeof v !== 'string' || !v) continue;
      if (VALOR_DE_EXEMPLO.test(v)) return helpers.message({ custom: `${nome} tem um valor de exemplo — gere um segredo (openssl rand -hex 32)` });
      const repetido = vistos.get(v);
      if (repetido) return helpers.message({ custom: `${nome} é igual a ${repetido} — cada segredo tem de ser próprio` });
      vistos.set(v, nome);
    }
    // OPS-17: um Redis noutra máquina/contentor sem palavra-passe é uma porta aberta às sessões,
    // ao throttler e ao barramento entre réplicas.
    const redis = String(valores['REDIS_URL'] ?? '');
    if (redisRemotoSemPassword(redis)) {
      return helpers.message({ custom: 'REDIS_URL sem palavra-passe — use redis://:<REDIS_PASSWORD>@host:6379' });
    }
    if (valores['HL7_API_TOKEN'] && !valores['HL7_ORIGENS_PERMITIDAS']) {
      return helpers.message({ custom: 'HL7_ORIGENS_PERMITIDAS é obrigatório com HL7_API_TOKEN — indique os IPs do motor de integração' });
    }
    return valores;
  })
  .unknown(true);

/** Redis fora desta máquina e sem palavra-passe no URL. */
export function redisRemotoSemPassword(url: string): boolean {
  try {
    const u = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
    return !local && !u.password;
  } catch {
    return false;
  }
}

/** Valida (para testes e para o arranque): devolve a mensagem de erro, ou null. */
export function erroDeConfiguracao(env: Record<string, unknown>): string | null {
  const { error } = esquemaConfiguracao.validate(env, { abortEarly: true });
  return error ? error.message : null;
}
