/**
 * QA-20 — ambiente dos testes de integração (antes de qualquer import da aplicação).
 * A BD é DESCARTÁVEL: é apagada e recriada no globalSetup. Nunca apontar para dados reais.
 */
import { AUDIT_SIGNING_KEY_INTEGRACAO, ENCRYPTION_KEY_INTEGRACAO } from './chaves';

export const URL_BD_INTEGRACAO =
  process.env['DATABASE_URL_INTEGRACAO'] ?? 'postgresql://postgres:postgres@localhost:5432/enfermaria_integracao';

process.env['DATABASE_URL'] = URL_BD_INTEGRACAO;
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'teste-integracao-segredo-com-mais-de-32-caracteres';
process.env['ENCRYPTION_KEY'] = ENCRYPTION_KEY_INTEGRACAO;
process.env['AUDIT_SIGNING_KEY'] = AUDIT_SIGNING_KEY_INTEGRACAO;
// Redis inexistente de propósito: a API tem de funcionar degradada (e os limites ficam em memória).
process.env['REDIS_URL'] = 'redis://127.0.0.1:6399';
process.env['ALLOWED_ORIGINS'] = 'http://localhost:3000';
process.env['LOGIN_THROTTLE_LIMIT'] = '1000';
process.env['MFA_THROTTLE_LIMIT'] = '1000';
process.env['HL7_API_TOKEN'] = 'token-hl7-de-integracao';
process.env['QUIOSQUE_SECRET'] = 'segredo-de-quiosque-de-integracao-0123456789';
process.env['LOG_LEVEL'] ??= 'silent'; // LOG_LEVEL=error para diagnosticar um 500
delete process.env['ANTHROPIC_API_KEY'];
delete process.env['IA_DECISAO_CLINICA'];
