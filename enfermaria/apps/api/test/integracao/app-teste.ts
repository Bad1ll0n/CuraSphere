import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Pool } from 'pg';
import { generate } from 'otplib';
import { AppModule } from '../../src/app/app.module';
import { configurarApp } from '../../src/app/configurar-app';
import { URL_BD_INTEGRACAO } from './ambiente';

/**
 * QA-20 — a aplicação REAL (AppModule completo, interceptors e guards globais, extensão de
 * cifragem do Prisma, triggers de auditoria) a servir HTTP numa porta aleatória, configurada
 * pela mesma `configurarApp` do main.ts. Os testes falam com ela como o browser fala.
 */
export interface Contexto {
  app: NestExpressApplication;
  url: string;
  bd: Pool;
  /** Uma sessão por persona, reutilizada no ficheiro (cada login MFA gasta uma janela TOTP). */
  sessoes: Map<string, Promise<Sessao>>;
}

export async function arrancar(): Promise<Contexto> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication<NestExpressApplication>({
    logger: process.env['LOG_LEVEL'] === 'silent' ? false : ['error', 'warn'],
  });
  configurarApp(app);
  await app.listen(0, '127.0.0.1');
  const endereco = app.getHttpServer().address() as { port: number };
  return {
    app,
    url: `http://127.0.0.1:${endereco.port}/v1`,
    bd: new Pool({ connectionString: URL_BD_INTEGRACAO, max: 3 }),
    sessoes: new Map(),
  };
}

export async function parar(ctx: Contexto | undefined): Promise<void> {
  if (!ctx) return;
  await ctx.bd.end();
  await ctx.app.close();
}

export const PASSWORD = 'Teste1234!';
const SEGREDO_TOTP = 'EWA62CRGBGCMZVKZOEQ7GL2YIMOUSIBV';
// Anti-replay do TOTP: o mesmo utilizador não pode usar o mesmo código duas vezes. O Jest dá a
// cada ficheiro de teste um contexto próprio, por isso a última janela usada fica num ficheiro.
const FICHEIRO_JANELAS = join(tmpdir(), `curasphere-integracao-totp-${process.ppid}.json`);
async function reservarJanela(numero: string): Promise<void> {
  let usadas: Record<string, number> = {};
  try { usadas = JSON.parse(readFileSync(FICHEIRO_JANELAS, 'utf8')); } catch { /* primeira vez */ }
  const janela = () => Math.floor(Date.now() / 30_000);
  if (usadas[numero] === janela()) await new Promise((ok) => setTimeout(ok, 30_000 - (Date.now() % 30_000) + 500));
  usadas[numero] = janela();
  writeFileSync(FICHEIRO_JANELAS, JSON.stringify(usadas));
}

export interface Resposta { status: number; json: any; cabecalhos: Headers }

/** Uma sessão de browser: cookies httpOnly, token CSRF, MFA. */
export class Sessao {
  private cookies: Record<string, string> = {};
  constructor(private readonly base: string) {}

  private guardar(r: Response) {
    for (const c of r.headers.getSetCookie?.() ?? []) {
      const [par] = c.split(';');
      const i = par.indexOf('=');
      const valor = par.slice(i + 1);
      if (valor) this.cookies[par.slice(0, i)] = valor;
      else delete this.cookies[par.slice(0, i)];
    }
  }

  async pedido(metodo: string, caminho: string, corpo?: unknown, cabecalhos: Record<string, string> = {}): Promise<Resposta> {
    if (metodo !== 'GET' && !this.cookies['csrf-token']) await this.pedido('GET', '/csrf-token');
    const r = await fetch(this.base + caminho, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; '),
        ...(this.cookies['csrf-token'] ? { 'X-CSRF-Token': this.cookies['csrf-token'] } : {}),
        ...cabecalhos,
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    this.guardar(r);
    let json: any = null;
    try { json = await r.json(); } catch { /* sem corpo */ }
    return { status: r.status, json, cabecalhos: r.headers };
  }

  async entrar(numero: string): Promise<this> {
    await this.pedido('GET', '/csrf-token');
    let r = await this.pedido('POST', '/auth/login', { numeroFuncionario: numero, password: PASSWORD });
    if (r.json?.mfaPendente) {
      await reservarJanela(numero);
      r = await this.pedido('POST', '/auth/mfa/verificar', {
        mfaChallengeToken: r.json.mfaChallengeToken,
        code: await generate({ secret: SEGREDO_TOTP }),
      });
    }
    if (r.status >= 300) throw new Error(`login ${numero}: ${r.status} ${JSON.stringify(r.json)}`);
    await this.pedido('GET', '/csrf-token');
    return this;
  }
}

/** Sessão da persona `numero` (reutilizada no ficheiro). Para uma sessão nova: `new Sessao(ctx.url).entrar(n)`. */
export function entrar(ctx: Contexto, numero: string): Promise<Sessao> {
  let s = ctx.sessoes.get(numero);
  if (!s) {
    s = new Sessao(ctx.url).entrar(numero);
    ctx.sessoes.set(numero, s);
    s.catch(() => ctx.sessoes.delete(numero));
  }
  return s;
}

/** Fixtures por SQL: o que o teste precisa de existir, não o que está a ser testado. */
export async function idDe(ctx: Contexto, numero: string): Promise<string> {
  const r = await ctx.bd.query('SELECT id FROM utilizadores WHERE "numeroFuncionario" = $1', [numero]);
  return r.rows[0].id;
}

export interface DoenteFixture { doenteId: string; camaId: string; turnoId: string }

/** Doente internado numa cama nova, com um turno aberto e (opcionalmente) atribuições. */
export async function criarDoenteInternado(ctx: Contexto, atribuidoA: string[] = []): Promise<DoenteFixture> {
  const doenteId = randomUUID(), camaId = randomUUID(), turnoId = randomUUID();
  const sufixo = doenteId.slice(0, 8);
  await ctx.bd.query(`INSERT INTO camas (id, numero, quarto, estado, servico) VALUES ($1, $2, 'INT', 'ocupada', 'INTEGRACAO')`, [camaId, `INT-${sufixo}`]);
  await ctx.bd.query(
    `INSERT INTO doentes (id, nome, "numeroProcesso", "dataNascimento", "diagnosticoPrincipal", "camaId", "estadoRegisto", "dataAdmissao", "administrativoAdmissaoId")
     VALUES ($1, $2, $3, '1950-05-05', 'Pneumonia', $4, 'internado', now() - interval '1 day', $5)`,
    [doenteId, `Doente Integração ${sufixo}`, `INT-${sufixo}`, camaId, await idDe(ctx, '00007')],
  );
  await ctx.bd.query(
    `INSERT INTO turnos (id, tipo, "dataInicio", "dataFim", "chefeTurnoId") VALUES ($1, 'manha', now() - interval '1 hour', now() + interval '8 hours', $2)`,
    [turnoId, await idDe(ctx, '00015')],
  );
  for (const n of atribuidoA) {
    await ctx.bd.query(`INSERT INTO atribuicoes_doente (id, "doenteId", "enfermeiroId", "turnoId") VALUES ($1, $2, $3, $4)`,
      [randomUUID(), doenteId, await idDe(ctx, n), turnoId]);
  }
  return { doenteId, camaId, turnoId };
}
