import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { DOMINIOS, LETRA_SENHA, PRIORIDADES_SENHA, TIPOS_SENHA } from '@org/shared';
import { euros, multiplicarEuros, somarEuros } from './dinheiro';
import { Prisma } from '../../generated/prisma';

/**
 * ARQ-22 — modelação do schema: valores permitidos com CHECK na BD, dinheiro em Decimal e
 * timestamps de criação. Guardas estruturais para que o schema não volte a divergir.
 */
const PRISMA = join(__dirname, '..', '..', '..', 'prisma');
const schema = readFileSync(join(PRISMA, 'schema.prisma'), 'utf8').replace(/\r\n/g, '\n');
const migracoes = readdirSync(join(PRISMA, 'migrations'))
  .filter((d) => /^\d{14}_/.test(d))
  .sort()
  .map((d) => { try { return readFileSync(join(PRISMA, 'migrations', d, 'migration.sql'), 'utf8'); } catch { return ''; } })
  .join('\n');

const modelos = new Map<string, string>();
for (const m of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) modelos.set(m[1], m[2]);
const tabelaDe = (modelo: string) => /@@map\("([^"]+)"\)/.exec(modelos.get(modelo) ?? '')?.[1] ?? modelo;
const linhaDe = (modelo: string, campo: string) =>
  (modelos.get(modelo) ?? '').split('\n').find((l) => new RegExp(`^\\s*${campo}\\s`).test(l)) ?? '';

describe('ARQ-22 — valores permitidos dos campos de estado/tipo', () => {
  it.each(Object.entries(DOMINIOS))('%s: CHECK na BD e comentário do schema iguais à lista partilhada', (chave, valores) => {
    const [modelo, campo] = chave.split('.');
    const linha = linhaDe(modelo, campo);
    expect(linha).toMatch(/\bString\??/);
    // comentário do schema
    const comentario = linha.split('//')[1]?.split('|').map((v) => v.trim()) ?? [];
    expect(comentario).toEqual([...valores]);
    // o CHECK mais recente para esta coluna
    const nome = `ck_${tabelaDe(modelo)}_${campo}`.toLowerCase();
    const checks = [...migracoes.matchAll(new RegExp(`ADD CONSTRAINT "${nome}" CHECK \\("${campo}" IN \\(([^)]*)\\)\\)`, 'g'))];
    expect(checks.length).toBeGreaterThan(0);
    const naBd = [...(checks.at(-1)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(naBd).toEqual([...valores]);
  });

  it('as senhas: tipos = letras do quiosque, prioridades = as da fila', () => {
    expect([...TIPOS_SENHA].sort()).toEqual(Object.keys(LETRA_SENHA).sort());
    expect([...PRIORIDADES_SENHA]).toEqual(['normal', 'prioritario', 'senior']);
  });

  it('um comentário "a | b | c" num campo String tem de estar na lista partilhada (e por isso na BD)', () => {
    const semDominio: string[] = [];
    for (const [modelo, corpo] of modelos) {
      for (const l of corpo.split('\n')) {
        const m = /^\s*(\w+)\s+String\??[^/]*\/\/\s*([a-z_]+(?:\s*\|\s*[a-z_]+)+)\s*$/.exec(l);
        if (m && !DOMINIOS[`${modelo}.${m[1]}`]) semDominio.push(`${modelo}.${m[1]}`);
      }
    }
    expect(semDominio).toEqual([]);
  });
});

describe('ARQ-22 — dinheiro', () => {
  const MONETARIO = /^(preco\w*|custo\w*|montante\w*|totalBase|totalCobrado)$/;
  const MODELOS_FATURACAO = ['ItemFatura', 'Pagamento', 'EpisodioFaturacao'];

  it('nenhum valor monetário em Float', () => {
    const emFloat: string[] = [];
    for (const [modelo, corpo] of modelos) {
      for (const l of corpo.split('\n')) {
        const m = /^\s*(\w+)\s+Float\b/.exec(l);
        if (m && (MONETARIO.test(m[1]) || MODELOS_FATURACAO.includes(modelo))) emFloat.push(`${modelo}.${m[1]}`);
      }
    }
    expect(emFloat).toEqual([]);
  });

  it('as contas fazem-se ao cêntimo, sem erros de vírgula flutuante', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(somarEuros([0.1, 0.2])).toBe(0.3);
    expect(somarEuros([new Prisma.Decimal('10.10'), new Prisma.Decimal('20.20'), null])).toBe(30.3);
    expect(multiplicarEuros(new Prisma.Decimal('19.99'), 3)).toBe(59.97);
    expect(euros(undefined)).toBe(0);
  });

  it('o Decimal sai em JSON como número (o contrato da API não muda)', () => {
    expect(JSON.stringify({ v: new Prisma.Decimal('12.50') })).toBe('{"v":12.5}');
  });
});

describe('ARQ-22 — timestamps', () => {
  // Modelos que já existiam sem data de criação (configuração, ligações, locks). Não cresce.
  const SEM_CRIACAO = new Set([
    'RoleConfig', 'SubRoleConfig', 'Cama', 'Turno', 'AtribuicaoDoente', 'PassagemTurno', 'ParametroDotacao',
    'HorarioTurno', 'HorarioTurnoProfissional', 'AtribuicaoHorarioTurno', 'TotpConsumido', 'CronLock',
    'ContactoEmergencia', 'FicheiroExame', 'ChecklistCirurgia', 'SessaoFisioterapia', 'FicheiroPessoalDoente',
    'ItemProtocolo', 'ConformidadeChecklistItem', 'IdentificadorExterno', 'CicloQuimioterapia',
  ]);
  // Modelos antigos com nomes em inglês. Os novos usam criadoEm/criadaEm e atualizadoEm/atualizadaEm.
  const EM_INGLES = new Set(['AvaliacaoFerida', 'BolsaSangue', 'PedidoTransfusao', 'AuditLog', 'AcessoLeitura', 'FeatureFlag']);

  it('todos os modelos novos registam quando foram criados', () => {
    const sem = [...modelos].filter(([n, c]) => !/DateTime\s+@default\(now\(\)\)/.test(c) && !SEM_CRIACAO.has(n)).map(([n]) => n);
    expect(sem).toEqual([]);
  });

  it('a lista de exceções só encolhe', () => {
    const aindaSem = [...SEM_CRIACAO].filter((n) => modelos.has(n) && !/DateTime\s+@default\(now\(\)\)/.test(modelos.get(n) ?? ''));
    expect(aindaSem.sort()).toEqual([...SEM_CRIACAO].filter((n) => modelos.has(n)).sort());
  });

  it('nomes de timestamp em português nos modelos novos', () => {
    const ingles = [...modelos].filter(([n, c]) => /^\s*(createdAt|updatedAt)\s/m.test(c) && !EM_INGLES.has(n)).map(([n]) => n);
    expect(ingles).toEqual([]);
  });
});
