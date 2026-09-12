/**
 * F-08 / A6: "falhou a carregar" e "nao ha dados" nao podem ser o mesmo ecra.
 *
 * Numa enfermaria e a ambiguidade que faz o dano: o MAR dizia "Sem medicacoes para este
 * turno" quando a rede falhava, e no telemovel dizia "Todas as medicacoes administradas",
 * com um visto verde. Este teste enumera os ecras que carregam dados e falha quando um
 * ecra NOVO mostra um estado vazio sem tratar o erro da carga, ou engole a falha num catch
 * vazio.
 *
 * A lista de ecras-erro-vs-vazio.json e divida declarada, nao permissao: so pode encolher. Corrigir um ecra
 * obriga a remove-lo da lista, senao este teste falha a exigir a remocao.
 *
 * Para regenerar a lista depois de corrigir ecras:
 *   ATUALIZAR_BASELINE=1 pnpm nx run @org/web:test --skip-nx-cache
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const RAIZ = join(__dirname, 'app');
const FICHEIRO_BASE = join(__dirname, 'ecras-erro-vs-vazio.json');

function ecras(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : ecras(p);
    return e.name === 'page.tsx' ? [p] : [];
  });
}

const semComentarios = (s: string) => s.replace(/(^|[^:])\/\/.*$/gm, '$1');

const CARREGA = /useQuery\s*[<(]|api\.get\(|quiosqueFetch\(|fetch\(/;
const ESTADO_VAZIO = />\s*(?:Sem|Nenhum|Nenhuma|Nao ha|Nao existem|Lista vazia)/;
const TRATA_ERRO = [
  /isError/,
  /const\s*\{[^}]*\berror\b[^}]*\}\s*=\s*useQuery/,
  /erroCarga|setErroCarga/,
  /ErroCarregamento/,
];
// catch vazio (ou so com comentario) logo a seguir a uma carga
const CATCH_VAZIO =
  /(api\.get|fetch)\([\s\S]{0,400}?(catch\s*(\([^)]*\))?\s*\{\s*(\/\*[^*]*\*\/)?\s*\}|\.catch\(\s*\(\s*\)\s*=>\s*(\{\s*(\/\*[^*]*\*\/)?\s*\}|null|undefined|\[\])\s*\))/;

function porCorrigir(): string[] {
  const fora: string[] = [];
  for (const f of ecras(RAIZ)) {
    const bruto = readFileSync(f, 'utf8');
    const src = semComentarios(bruto);
    if (!CARREGA.test(src)) continue;
    if (TRATA_ERRO.some((r) => r.test(src))) continue;
    if (ESTADO_VAZIO.test(src) || CATCH_VAZIO.test(bruto)) {
      fora.push(relative(RAIZ, f).replace(/\\/g, '/'));
    }
  }
  return fora.sort();
}

describe('estrutura web - erro de carga vs lista vazia', () => {
  const actuais = porCorrigir();

  if (process.env['ATUALIZAR_BASELINE'] === '1') {
    writeFileSync(FICHEIRO_BASE, JSON.stringify(actuais, null, 2) + '\n');
  }

  const base: string[] = JSON.parse(readFileSync(FICHEIRO_BASE, 'utf8'));

  it('as expressoes apanham de facto o que dizem apanhar', () => {
    // Uma regra estrutural que nunca dispara e indistinguivel de uma regra partida.
    expect(CARREGA.test('const r = await api.get("/x");')).toBe(true);
    expect(ESTADO_VAZIO.test('<Text>Sem tarefas</Text>')).toBe(true);
    expect(TRATA_ERRO.some((r) => r.test('const [erroCarga, setErroCarga] = useState(false);'))).toBe(true);
    expect(CATCH_VAZIO.test('await api.get("/x"); } catch { /* ignorar */ }')).toBe(true);
  });

  it('nenhum ecra NOVO confunde falha de carga com lista vazia', () => {
    const novos = actuais.filter((f) => !base.includes(f));

    expect(novos).toEqual([]);
  });

  it('a lista so encolhe - remover daqui quem ja distingue os dois casos', () => {
    const jaCorrigidos = base.filter((f) => !actuais.includes(f));

    expect(jaCorrigidos).toEqual([]);
  });
});
