/**
 * Chaves só da integração, usadas pela semente (globalSetup) e pela aplicação em teste (ambiente.ts):
 * a semente tem de cifrar com a MESMA chave com que os testes decifram. Antes, a semente lia a chave
 * do .env local (outra chave) e na CI, sem .env, falhava por não ter nenhuma.
 */
export const ENCRYPTION_KEY_INTEGRACAO = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
export const AUDIT_SIGNING_KEY_INTEGRACAO = 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
