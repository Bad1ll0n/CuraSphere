#!/usr/bin/env ts-node
/**
 * Smoke test: verifica que todos os endpoints críticos respondem sem 5xx.
 * Exit code 1 se qualquer endpoint retornar status >= 500.
 *
 * Uso:
 *   BASE_URL=http://localhost:3001 pnpm ts-node scripts/smoke-test-api.ts
 */

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3001';
const TEST_USER = process.env['TEST_USER'] ?? '00001';
const TEST_PASSWORD = process.env['TEST_PASSWORD'] ?? 'Admin1234!';

interface CheckResult {
  label: string;
  status: number;
  ok: boolean;
}

async function request(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string } = {},
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}

async function check(
  label: string,
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; expectedStatus?: number } = {},
): Promise<CheckResult> {
  try {
    const res = await request(method, path, opts);
    const expected = opts.expectedStatus;
    const ok = expected ? res.status === expected : res.status < 500;
    if (!ok) {
      console.error(`  FAIL  [${res.status}] ${method} ${path} — ${label}`);
    } else {
      console.log(`  OK    [${res.status}] ${method} ${path} — ${label}`);
    }
    return { label, status: res.status, ok };
  } catch (err) {
    console.error(`  ERROR [---] ${method} ${path} — ${label}: ${(err as Error).message}`);
    return { label, status: 0, ok: false };
  }
}

async function main() {
  console.log(`\nSmoke test → ${BASE_URL}\n`);

  const results: CheckResult[] = [];

  // ── Health ──────────────────────────────────────────────────────────────────
  results.push(await check('health check', 'GET', '/v1/health'));

  // ── Auth — sem token ────────────────────────────────────────────────────────
  results.push(await check('login credenciais inválidas → 401', 'POST', '/v1/auth/login', {
    body: { utilizadorId: '00000', password: 'wrong' },
    expectedStatus: 401,
  }));
  results.push(await check('GET /me sem token → 401', 'GET', '/v1/auth/me', { expectedStatus: 401 }));
  results.push(await check('GET /doentes sem token → 401', 'GET', '/v1/doentes', { expectedStatus: 401 }));
  results.push(await check('GET /faturacao sem token → 401', 'GET', '/v1/faturacao', { expectedStatus: 401 }));
  results.push(await check('GET /utilizadores sem token → 401', 'GET', '/v1/utilizadores', { expectedStatus: 401 }));
  results.push(await check('GET /horarios sem token → 401', 'GET', '/v1/horarios', { expectedStatus: 401 }));
  results.push(await check('GET /notificacoes sem token → 401', 'GET', '/v1/notificacoes', { expectedStatus: 401 }));
  results.push(await check('GET /auditoria sem token → 401', 'GET', '/v1/auditoria', { expectedStatus: 401 }));

  // ── Auth — login ─────────────────────────────────────────────────────────────
  let token: string | null = null;
  try {
    const loginRes = await request('POST', '/v1/auth/login', {
      body: { utilizadorId: TEST_USER, password: TEST_PASSWORD },
    });
    if (loginRes.ok) {
      const body = await loginRes.json() as any;
      token = body.accessToken ?? null;
      console.log(`  OK    [${loginRes.status}] POST /v1/auth/login — login admin`);
    } else {
      console.warn(`  WARN  [${loginRes.status}] login falhou — testes autenticados serão ignorados`);
    }
    results.push({ label: 'login admin', status: loginRes.status, ok: loginRes.ok });
  } catch (err) {
    console.error(`  ERROR login: ${(err as Error).message}`);
    results.push({ label: 'login admin', status: 0, ok: false });
  }

  // ── Endpoints autenticados ──────────────────────────────────────────────────
  if (token) {
    const auth = { token };

    results.push(await check('GET /me', 'GET', '/v1/auth/me', auth));
    results.push(await check('GET /doentes', 'GET', '/v1/doentes', auth));
    results.push(await check('GET /horarios', 'GET', '/v1/horarios', auth));
    results.push(await check('GET /faturacao', 'GET', '/v1/faturacao', auth));
    results.push(await check('GET /utilizadores', 'GET', '/v1/utilizadores', auth));
    results.push(await check('GET /notificacoes', 'GET', '/v1/notificacoes', auth));
    results.push(await check('GET /auditoria', 'GET', '/v1/auditoria', auth));
    results.push(await check('GET /relatorio-passagem-turno', 'GET', '/v1/relatorio-passagem-turno', auth));
    results.push(await check('GET /camas', 'GET', '/v1/camas', auth));
    results.push(await check('GET /medicacao/pendentes-medico', 'GET', '/v1/medicacao/pendentes-medico', auth));
    results.push(await check('GET /auth/password-status', 'GET', '/v1/auth/password-status', auth));

    // Endpoints que requerem IDs — verificar apenas que não retornam 500
    results.push(await check('GET /doentes/:id inexistente → 403 ou 404', 'GET', '/v1/doentes/smoke-test-id-999', auth));
    results.push(await check('GET /faturacao/:id inexistente → 404', 'GET', '/v1/faturacao/smoke-test-id-999', auth));
  }

  // ── Resumo ───────────────────────────────────────────────────────────────────
  const falhas = results.filter((r) => !r.ok);
  const total = results.length;
  const passou = total - falhas.length;

  console.log(`\n────────────────────────────────────────`);
  console.log(`Resultado: ${passou}/${total} checks OK`);

  if (falhas.length > 0) {
    console.error(`\nFalhas (${falhas.length}):`);
    falhas.forEach((f) => console.error(`  - ${f.label} [${f.status}]`));
    process.exit(1);
  } else {
    console.log('Smoke test concluído sem erros.\n');
  }
}

main();
