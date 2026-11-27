#!/usr/bin/env node
/**
 * PERF-10 — mede o JavaScript inicial (gzip) de cada rota a partir do build de produção.
 *
 * JS inicial = ficheiros-raiz do Next (rootMainFiles) + todos os chunks referenciados pelos
 * componentes cliente da rota (layouts + página), lidos dos *client-reference-manifest*.
 * Chunks carregados com `dynamic()` / `import()` não entram: só chegam quando são usados.
 *
 * Uso:  node scripts/medir-bundle.mjs [--json] [--limite-kb=N]
 *   --limite-kb  falha (exit 1) se alguma rota passar do limite.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const NEXT = join(dirname(fileURLToPath(import.meta.url)), '..', '.next');
if (!existsSync(join(NEXT, 'build-manifest.json'))) {
  console.error('Sem build: corra primeiro `pnpm nx run @org/web:build`.');
  process.exit(2);
}
const args = process.argv.slice(2);
const json = args.includes('--json');
const limiteKb = Number(args.find((a) => a.startsWith('--limite-kb='))?.split('=')[1] ?? 0);

const raiz = JSON.parse(readFileSync(join(NEXT, 'build-manifest.json'), 'utf8')).rootMainFiles ?? [];
const cacheGzip = new Map();
const gz = (f) => {
  if (!cacheGzip.has(f)) {
    const p = join(NEXT, f);
    cacheGzip.set(f, existsSync(p) ? gzipSync(readFileSync(p)).length : 0);
  }
  return cacheGzip.get(f);
};

function manifests(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return manifests(p);
    return n === 'page_client-reference-manifest.js' ? [p] : [];
  });
}

const rotas = [];
for (const m of manifests(join(NEXT, 'server', 'app'))) {
  const src = readFileSync(m, 'utf8');
  const obj = JSON.parse(src.slice(src.indexOf('={') + 1).trim().replace(/;$/, ''));
  const ficheiros = new Set(raiz);
  for (const mod of Object.values(obj.clientModules ?? {})) {
    const chunks = mod.chunks ?? [];
    // formato webpack: [id, ficheiro, id, ficheiro, ...]
    for (let i = 1; i < chunks.length; i += 2) ficheiros.add(chunks[i].replace(/^\/?_next\//, ''));
  }
  const total = [...ficheiros].reduce((s, f) => s + gz(f), 0);
  const rota = '/' + relative(join(NEXT, 'server', 'app'), dirname(m)).replace(/\\/g, '/').split('/').filter((s) => !/^\(.*\)$/.test(s)).join('/');
  rotas.push({ rota: rota === '/' ? '/' : rota.replace(/\/$/, ''), kb: Math.round(total / 1024) });
}
rotas.sort((a, b) => b.kb - a.kb);

if (json) console.log(JSON.stringify(rotas, null, 2));
else {
  const kbs = rotas.map((r) => r.kb);
  console.log(`rotas: ${rotas.length} · min ${Math.min(...kbs)} KB · mediana ${kbs[Math.floor(kbs.length / 2)]} KB · máx ${Math.max(...kbs)} KB (gzip)`);
  for (const r of rotas.slice(0, 15)) console.log(`${String(r.kb).padStart(5)} KB  ${r.rota}`);
}
if (limiteKb) {
  const acima = rotas.filter((r) => r.kb > limiteKb);
  if (acima.length) {
    console.error(`\n${acima.length} rota(s) acima de ${limiteKb} KB gzip:`);
    for (const r of acima) console.error(`  ${r.kb} KB  ${r.rota}`);
    process.exit(1);
  }
}
