/**
 * E2E dos módulos de especialidade (Sessão 74): Pediatria, Maternidade, Oncologia, Diálise e
 * Radiologia (RIS). Nível de API (Playwright request, sem browser). Trava o comportamento de
 * segurança clínica: DPP (Naegele), BSA + dose-máxima de quimioterapia, ganho interdialítico, e
 * o fluxo pedido→laudo→assinatura que alimenta o resultado do exame.
 *
 * Requer a seed de teste + a API em http://localhost:3333 (LOGIN_THROTTLE_LIMIT elevado em teste).
 * Detalhe fino dos cálculos está nos unit tests dos helpers (pews/obstetricia/oncologia/dialise).
 */
import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { createHmac } from 'crypto';

const API = process.env['API_URL'] ?? 'http://localhost:3333';
const PASS = process.env['TEST_PASSWORD'] ?? 'Teste1234!';
const TOTP_SECRET = process.env['TEST_TOTP_SECRET'] ?? 'EWA62CRGBGCMZVKZOEQ7GL2YIMOUSIBV';
const MOTIVO_BG = 'Verificação E2E automatizada das especialidades clínicas';

function b32(s: string): Buffer {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) { const i = alpha.indexOf(c); if (i >= 0) bits += i.toString(2).padStart(5, '0'); }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
function totp(secret: string): string {
  const buf = Buffer.alloc(8); buf.writeBigInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = createHmac('sha1', b32(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  return ((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).toString().padStart(6, '0');
}
async function csrf(ctx: APIRequestContext) { return (await ctx.storageState()).cookies.find((c) => c.name === 'csrf-token')?.value; }

async function login(num: string, clinico: boolean): Promise<{ ctx: APIRequestContext; user: any }> {
  const ctx = await pwRequest.newContext({ baseURL: API });
  const r = await ctx.post('/v1/auth/login', { data: { numeroFuncionario: num, password: PASS } });
  expect(r.ok(), `login ${num}: ${r.status()}`).toBeTruthy();
  let body = await r.json();
  if (clinico) {
    const v = await ctx.post('/v1/auth/mfa/verificar', {
      data: { mfaChallengeToken: body.mfaChallengeToken, code: totp(TOTP_SECRET) },
      headers: { 'x-csrf-token': (await csrf(ctx)) ?? '' },
    });
    expect(v.ok(), `mfa ${num}: ${v.status()}`).toBeTruthy();
    body = await v.json();
  }
  return { ctx, user: body.utilizador };
}
async function post(ctx: APIRequestContext, url: string, data: any) {
  return ctx.post(url, { data, headers: { 'x-csrf-token': (await csrf(ctx)) ?? '' } });
}

test.describe.configure({ mode: 'serial' });
test.describe('Módulos de especialidade — wiring E2E', () => {
  let medico: { ctx: APIRequestContext; user: any };
  let doenteId: string;

  test.beforeAll(async () => {
    medico = await login('00002', true);
    const dir = await login('00001', false); // direção (oversight) vê todos os doentes
    const lista = await dir.ctx.get('/v1/doentes?limit=1');
    doenteId = (await lista.json()).data?.[0]?.id;
    await dir.ctx.dispose();
    expect(doenteId, 'seed precisa de ≥1 doente').toBeTruthy();
    // break-glass cobre os endpoints por-doente (maternidade/oncologia/diálise) desta sessão
    const bg = await post(medico.ctx, '/v1/break-glass', { doenteId, motivo: MOTIVO_BG });
    expect([200, 201]).toContain(bg.status());
  });
  test.afterAll(async () => { await medico?.ctx.dispose(); });

  // ── Pediatria: dose por peso ────────────────────────────────────────────────
  test('pediatria: dose por peso = mg/kg × kg (com limite diário)', async () => {
    const r = await post(medico.ctx, '/v1/pediatria/calcular-dose', { mgPorKg: 15, pesoKg: 20, frequenciaDia: 3 });
    expect(r.status(), 'calcular dose').toBe(201);
    const d = await r.json();
    expect(d.doseMg).toBe(300);       // 15 × 20
    expect(d.doseDiariaMg).toBe(900); // × 3 tomas
  });

  // ── Maternidade: DPP (Naegele) + parto conclui a gravidez ───────────────────
  test('maternidade: DPP = DUM + 280d e o parto conclui a gravidez', async () => {
    const g = await post(medico.ctx, `/v1/maternidade/doente/${doenteId}/gravidez`, {
      dataUltimaMenstruacao: '2024-01-01', gravida: 1, para: 0,
    });
    expect(g.status(), 'criar gravidez').toBe(201);
    const grav = await g.json();
    expect(String(grav.dataPrevistaParto).slice(0, 10)).toBe('2024-10-07'); // Naegele

    const p = await post(medico.ctx, `/v1/maternidade/gravidez/${grav.id}/partograma`, { dilatacaoCm: 4, fcFetal: 140 });
    expect(p.status(), 'partograma').toBe(201);

    const parto = await post(medico.ctx, `/v1/maternidade/gravidez/${grav.id}/parto`, { tipo: 'eutocico', apgar5: 10 });
    expect(parto.status(), 'parto').toBe(201);

    const ativa = await medico.ctx.get(`/v1/maternidade/doente/${doenteId}/gravidez`);
    const corpo = await ativa.text();
    // gravidez concluída → sem gravidez ativa (null/corpo vazio) ou id diferente do que concluímos
    expect(corpo === '' || corpo === 'null' || JSON.parse(corpo)?.id !== grav.id).toBeTruthy();
  });

  // ── Oncologia: BSA (Mosteller) + dose máxima ────────────────────────────────
  test('oncologia: BSA e dose por m² com limite máximo', async () => {
    const r = await post(medico.ctx, `/v1/oncologia/doente/${doenteId}/plano`, {
      protocoloNome: 'FOLFOX-E2E', ciclosPrevistos: 6, pesoKg: 70, alturaCm: 170,
      farmacos: [{ nome: 'Oxaliplatina', mgPorM2: 85 }, { nome: '5-FU', mgPorM2: 400, doseMaximaMg: 600 }],
    });
    expect(r.status(), 'criar plano').toBe(201);
    const plano = await r.json();
    expect(plano.superficieCorporalM2).toBeCloseTo(1.82, 2); // √(170×70/3600)

    const ativo = await (await medico.ctx.get(`/v1/oncologia/doente/${doenteId}/plano`)).json();
    const fu = ativo.doses.find((d: any) => d.nome === '5-FU');
    expect(fu.doseMg).toBe(600);   // 400 × 1.82 = 728 → limitada a 600
    expect(fu.limitada).toBe(true);
  });

  // ── Diálise: ganho interdialítico ───────────────────────────────────────────
  test('diálise: ganho interdialítico = pré − pós anterior', async () => {
    await post(medico.ctx, `/v1/dialise/doente/${doenteId}/sessao`, {
      modalidade: 'hemodialise', data: '2026-07-20T09:00:00Z', pesoSecoKg: 70, pesoPreKg: 72, pesoPosKg: 70,
    });
    const s2 = await post(medico.ctx, `/v1/dialise/doente/${doenteId}/sessao`, {
      modalidade: 'hemodialise', data: '2026-07-23T09:00:00Z', pesoSecoKg: 70, pesoPreKg: 73, pesoPosKg: 70.2,
    });
    expect(s2.status(), 'registar sessão').toBe(201);
    const sessao = await s2.json();
    expect(sessao.ganhoInterdialitico).toBe(3);   // 73 − 70
    expect(sessao.ufObjetivoMl).toBe(3000);        // (73 − 70) × 1000
  });

  // ── Radiologia (RIS): pedido → laudo → assinatura alimenta o resultado ──────
  test('radiologia: assinar laudo alimenta o resultado do exame e remove-o da worklist', async () => {
    const ex = await post(medico.ctx, `/v1/exames/${doenteId}`, { tipo: 'rx', descricao: 'RX tórax PA (E2E)', urgente: true });
    expect(ex.status(), 'pedir exame').toBe(201);
    const exameId = (await ex.json()).id;

    const wl1 = await (await medico.ctx.get('/v1/radiologia/worklist')).json();
    expect(wl1.some((e: any) => e.id === exameId), 'exame na worklist por reportar').toBeTruthy();

    const l = await post(medico.ctx, `/v1/radiologia/exame/${exameId}/laudo`, {
      tecnica: 'RX tórax PA', achados: 'Sem consolidações.', conclusao: 'Sem alterações agudas.',
    });
    expect(l.status(), 'guardar laudo').toBe(201);
    const laudoId = (await l.json()).id;

    const ass = await post(medico.ctx, `/v1/radiologia/laudo/${laudoId}/assinar`, {});
    expect([200, 201]).toContain(ass.status());

    const depois = await (await medico.ctx.get(`/v1/radiologia/exame/${exameId}/laudo`)).json();
    expect(depois.estado).toBe('resultado_disponivel');
    expect(depois.resultado).toBe('Sem alterações agudas.'); // conclusão alimenta o resultado

    const wl2 = await (await medico.ctx.get('/v1/radiologia/worklist')).json();
    expect(wl2.some((e: any) => e.id === exameId), 'exame sai da worklist após reportado').toBeFalsy();
  });
});
