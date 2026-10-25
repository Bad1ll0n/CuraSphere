// Arranca a API já construída, carregando o .env primeiro (evita o watcher do nx serve).
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const linha of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '8';
require('./dist/main.js');
