import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * O service worker corre em computadores partilhados do serviço. Todas as páginas são renderizadas
 * no servidor com dados do doente: uma página em cache é uma ficha clínica que sobrevive ao logout.
 */
const sw = readFileSync(join(__dirname, '../../public/sw.js'), 'utf8');
const middleware = readFileSync(join(__dirname, '../middleware.ts'), 'utf8');

describe('service worker', () => {
  it('só escreve na cache dentro do ramo dos ficheiros imutáveis de _next/static', () => {
    const inicioEstaticos = sw.indexOf("url.pathname.startsWith('/_next/static/')");
    const inicioNavegacao = sw.indexOf("request.mode === 'navigate'");
    expect(inicioEstaticos).toBeGreaterThan(-1);
    expect(inicioNavegacao).toBeGreaterThan(inicioEstaticos);

    const escritas = [...sw.matchAll(/cache\.put\(|cache\.addAll\(/g)].map((m) => m.index ?? -1);
    const foraDoSitio = escritas.filter(
      (i) => !(i > inicioEstaticos && i < inicioNavegacao) && !sw.slice(i).startsWith('cache.addAll(STATIC_ASSETS)'),
    );
    expect(foraDoSitio).toEqual([]);
  });

  it('o pré-cache não inclui páginas', () => {
    const precache = sw.match(/const STATIC_ASSETS = (\[[^\]]*\])/)?.[1];
    expect(JSON.parse((precache ?? '').replace(/'/g, '"'))).toEqual(['/manifest.json']);
  });

  it('a navegação nunca é respondida a partir da cache', () => {
    const navegacao = sw.slice(sw.indexOf("request.mode === 'navigate'"));
    expect(navegacao).not.toMatch(/caches\.match/);
  });

  it('o middleware não redirecciona o sw.js — sem isso o browser recusa registá-lo', () => {
    const padrao = middleware.match(/matcher: \['(.+)'\]/)?.[1];
    expect(padrao).toBeDefined();
    const regex = new RegExp(`^${(padrao as string).replace(/\\\\/g, '\\')}$`);
    expect(regex.test('/sw.js')).toBe(false);
    expect(regex.test('/manifest.json')).toBe(false);
    expect(regex.test('/doentes/abc')).toBe(true);
  });
});
