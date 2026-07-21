// k6 ramp/soak — sobe a carga por degraus para encontrar o ponto onde a latência degrada.
// Corre:  k6 run load/ramp.js   (ajusta os alvos ao teu hardware/ambiente)
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3333';
const USER = __ENV.LOGIN_USER || '00001';
const PASS = __ENV.LOGIN_PASS || 'Teste1234!';

export const options = {
  scenarios: {
    rampa: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },  // aquecer
        { duration: '1m', target: 25 },   // carga nominal
        { duration: '1m', target: 50 },   // pico
        { duration: '30s', target: 0 },   // arrefecer
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    'http_req_duration{tipo:leitura}': ['p(95)<800', 'p(99)<1500'],
  },
};

export function setup() {
  const res = http.post(`${BASE}/v1/auth/login`, JSON.stringify({ numeroFuncionario: USER, password: PASS }), {
    headers: { 'Content-Type': 'application/json' },
  });
  return { cookies: res.cookies };
}

export default function (data) {
  const jar = http.cookieJar();
  for (const [name, arr] of Object.entries(data.cookies || {})) {
    if (arr && arr[0]) jar.set(BASE, name, arr[0].value);
  }
  const r = http.get(`${BASE}/v1/doentes?limit=20`, { tags: { tipo: 'leitura' } });
  check(r, { 'ok': (x) => x.status === 200 });
  sleep(Math.random() * 2);
}
