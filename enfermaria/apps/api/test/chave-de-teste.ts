/**
 * A suite unitária não pode depender do `.env` local. O Nx carrega-o cá, mas a CI não o tem: sem
 * ENCRYPTION_KEY, a cifragem desliga-se e os testes de cifra falhavam só na CI (cache cifrada, MFA,
 * decifragem em lotes). Esta é uma chave fixa só de teste, usada quando o ambiente não traz nenhuma.
 */
const CHAVE_SO_DE_TESTE = '0f'.repeat(32); // 64 hex = 32 bytes; nunca usada fora dos testes
if (!process.env['ENCRYPTION_KEY']) process.env['ENCRYPTION_KEY'] = CHAVE_SO_DE_TESTE;
