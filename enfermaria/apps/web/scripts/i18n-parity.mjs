#!/usr/bin/env node
// Guardrail i18n: garante que pt.json e en.json têm exatamente as mesmas chaves (recursivo).
// Falha (exit 1) se houver chaves só num dos catálogos — evita strings por traduzir.
// Uso:  node apps/web/scripts/i18n-parity.mjs   (ou `pnpm --filter @org/web i18n:check`)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const msgs = join(dir, '..', 'src', 'messages');
const pt = JSON.parse(readFileSync(join(msgs, 'pt.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(msgs, 'en.json'), 'utf8'));

function keys(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...keys(v, path));
    else out.push(path);
  }
  return out;
}

const ptKeys = new Set(keys(pt));
const enKeys = new Set(keys(en));
const soPt = [...ptKeys].filter((k) => !enKeys.has(k));
const soEn = [...enKeys].filter((k) => !ptKeys.has(k));

if (soPt.length === 0 && soEn.length === 0) {
  console.log(`✓ i18n em paridade — ${ptKeys.size} chaves em pt e en.`);
  process.exit(0);
}
if (soPt.length) console.error(`\n✗ ${soPt.length} chave(s) só em pt.json (faltam em en.json):\n  ` + soPt.join('\n  '));
if (soEn.length) console.error(`\n✗ ${soEn.length} chave(s) só em en.json (faltam em pt.json):\n  ` + soEn.join('\n  '));
process.exit(1);
