/**
 * QA-27: importado PRIMEIRO pelas seeds. Os módulos da app leem as variáveis (ex.: ENCRYPTION_KEY)
 * no momento em que são importados; com `process.loadEnvFile()` no corpo da seed, isso já tinha
 * acontecido — a cifragem ficava sem chave. As variáveis já definidas no ambiente prevalecem.
 */
try { process.loadEnvFile(); } catch { /* sem .env: usa as variáveis do ambiente */ }
