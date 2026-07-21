// k6 smoke test — carga mínima para confirmar que os caminhos críticos respondem dentro do
// orçamento de latência. Corre localmente:  k6 run load/smoke.js
// Env:  BASE_URL (default http://localhost:3333), LOGIN_USER (00001), LOGIN_PASS (Teste1234!)
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3333';
const USER = __ENV.LOGIN_USER || '00001';       // direção — login direto (sem MFA)
const PASS = __ENV.LOGIN_PASS || 'Teste1234!';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],                 // <1% de erros
    'http_req_duration{tipo:leitura}': ['p(95)<500'], // p95 das leituras < 500ms
    'http_req_duration{tipo:health}': ['p(95)<150'],
  },
};

export function setup() {
  // Um login para a sessão (cookies partilhados). Direção não exige MFA.
  const res = http.post(`${BASE}/v1/auth/login`, JSON.stringify({ numeroFuncionario: USER, password: PASS }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'login 201': (r) => r.status === 201 });
  return { cookies: res.cookies };
}

export default function (data) {
  const jar = http.cookieJar();
  for (const [name, arr] of Object.entries(data.cookies || {})) {
    if (arr && arr[0]) jar.set(BASE, name, arr[0].value);
  }

  const health = http.get(`${BASE}/v1/health`, { tags: { tipo: 'health' } });
  check(health, { 'health 200': (r) => r.status === 200 });

  const doentes = http.get(`${BASE}/v1/doentes?limit=20`, { tags: { tipo: 'leitura' } });
  check(doentes, { 'doentes ok': (r) => r.status === 200 });

  const notif = http.get(`${BASE}/v1/notificacoes`, { tags: { tipo: 'leitura' } });
  check(notif, { 'notificacoes ok': (r) => r.status === 200 });

  sleep(1);
}
