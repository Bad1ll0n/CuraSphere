/**
 * SEC-21 — o que nunca pode chegar aos logs (pino `redact`).
 *
 * Antes, a lista cobria só o primeiro nível (`*.nome`) e esquecia campos: `senha` do portal,
 * `novaPassword`, tokens, códigos TOTP, email, telefone, número de utente, diagnóstico e texto
 * clínico livre. E um erro do axios logado leva o pedido inteiro (`err.config.data`, com o corpo
 * e os cabeçalhos) — era por aí que dados de doentes enviados a terceiros iam parar ao Loki.
 *
 * O pino só aceita caminhos explícitos (sem `**`), por isso geram-se até três níveis de
 * profundidade, mais os elementos de listas.
 */
const SEGREDOS = [
  'password', 'passwordHash', 'passwordAtual', 'novaPassword', 'senha', 'mfaSecret', 'secret',
  'token', 'accessToken', 'refreshToken', 'passwordExpiredToken', 'totpCode', 'apiKey',
];

const PII = [
  'nome', 'nomeCompleto', 'contacto', 'telefone', 'telemovel', 'email', 'morada', 'nif',
  'numeroSns', 'numeroUtente', 'dataNascimento', 'diagnosticoPrincipal', 'diagnostico',
  'notas', 'observacoes', 'descricao', 'conteudo', 'mensagem',
];

const CAMPOS = [...SEGREDOS, ...PII];

function caminhos(campo: string): string[] {
  return [campo, `*.${campo}`, `*.*.${campo}`, `*.*.*.${campo}`, `[*].${campo}`, `*[*].${campo}`];
}

export const CAMINHOS_REDACT: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-hl7-token"]',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  // Erros do axios: o pedido inteiro vem agarrado ao erro.
  'err.config.data', 'err.config.headers', 'err.request', 'err.response.config',
  '*.config.data', '*.config.headers',
  ...CAMPOS.flatMap(caminhos),
];

export const CENSURA = '[REDACTED]';
