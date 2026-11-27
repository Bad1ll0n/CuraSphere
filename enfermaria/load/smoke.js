// k6 smoke — carga mínima sobre os caminhos que o turno usa, com orçamentos de latência.
// Corre localmente (API com seed-test-users + seed-volume):  k6 run load/smoke.js
// Env: BASE_URL (http://localhost:3333), LOGIN_PASS, TEST_TOTP_SECRET, SUMMARY_PATH
//
// PERF-09 — o que mede (cada grupo com o seu orçamento, e as `checks` contam para o resultado):
//  - leitura: o enfermeiro (00003, com MFA) lista os seus doentes (filtro de atribuição), abre a
//    ficha e os sinais vitais de um deles, e as notificações;
//  - pesquisa: a direção pesquisa por nome (índice cego) e o enfermeiro por nome fora dos seus;
//  - escrita: o enfermeiro regista sinais vitais (com CSRF, auditoria e NEWS2 a correr);
//  - websocket: ligações Socket.IO com bilhete, mantidas e com ping/pong.
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { entrar, usarSessao, get, post, ligarSocket } from './lib.js';

const wsLigou = new Rate('ws_ligou');

export const options = {
  scenarios: {
    turno: { executor: 'constant-vus', vus: 5, duration: '30s', exec: 'turno' },
    supervisao: { executor: 'constant-vus', vus: 2, duration: '30s', exec: 'supervisao' },
    tempo_real: { executor: 'constant-vus', vus: 3, duration: '30s', exec: 'tempoReal' },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{tipo:leitura}': ['p(95)<500'],
    'http_req_duration{tipo:pesquisa}': ['p(95)<600'],
    'http_req_duration{tipo:escrita}': ['p(95)<800'],
    ws_ligou: ['rate>0.99'],
  },
};

export function setup() {
  const enfermeiro = entrar('00003');
  usarSessao(enfermeiro);
  const meus = get('/doentes?limit=20', 'preparacao').json('data') || [];
  if (meus.length === 0) throw new Error('setup: o enfermeiro 00003 não tem doentes atribuídos no turno — correr seed-volume');
  return { enfermeiro, direcao: entrar('00001'), doentes: meus.map((d) => d.id) };
}

export function turno(data) {
  usarSessao(data.enfermeiro);
  const id = data.doentes[(__VU + __ITER) % data.doentes.length];

  check(get('/doentes?limit=20', 'leitura'), { 'lista dos meus doentes': (r) => r.status === 200 && r.json('data').length > 0 });
  check(get(`/doentes/${id}`, 'leitura'), { 'ficha': (r) => r.status === 200 });
  check(get(`/sinais-vitais/${id}`, 'leitura'), { 'sinais vitais': (r) => r.status === 200 });
  check(get('/notificacoes', 'leitura'), { 'notificações': (r) => r.status === 200 });
  check(get('/doentes?limit=8&search=Zulmira', 'pesquisa'), { 'pesquisa do enfermeiro': (r) => r.status === 200 });

  const sv = post(data.enfermeiro, `/sinais-vitais/${id}`, {
    pressaoSistolica: 110 + (__ITER % 30), pressaoDiastolica: 70, pulso: 80 + (__ITER % 15),
    temperatura: 36.8, saturacaoO2: 96, frequenciaRespiratoria: 16, avpu: 'A', o2Suplementar: false,
  }, 'escrita');
  check(sv, { 'regista sinais vitais': (r) => r.status === 201 });
  sleep(1);
}

export function supervisao(data) {
  usarSessao(data.direcao);
  check(get('/doentes?todos=true&limit=25&search=Maria%20Silva', 'pesquisa'), { 'pesquisa por nome': (r) => r.status === 200 && r.json('total') > 0 });
  check(get('/doentes?todos=true&limit=25&page=3', 'leitura'), { 'lista paginada': (r) => r.status === 200 });
  sleep(1);
}

export function tempoReal(data) {
  usarSessao(data.enfermeiro);
  wsLigou.add(ligarSocket(5));
}

export function handleSummary(dados) {
  return { [__ENV.SUMMARY_PATH || 'load/k6-summary.json']: JSON.stringify(dados, null, 2), stdout: resumo(dados) };
}

function resumo(d) {
  const m = d.metrics;
  const p95 = (k) => (m[k] ? `${Math.round(m[k].values['p(95)'])} ms` : '—');
  return [
    '', '── PERF-09 carga ──',
    `leituras p95  ${p95('http_req_duration{tipo:leitura}')}`,
    `pesquisa p95  ${p95('http_req_duration{tipo:pesquisa}')}`,
    `escritas p95  ${p95('http_req_duration{tipo:escrita}')}`,
    `ws ligou      ${m.ws_ligou ? (m.ws_ligou.values.rate * 100).toFixed(1) + '%' : '—'}`,
    `checks        ${m.checks ? (m.checks.values.rate * 100).toFixed(2) + '%' : '—'}`,
    `erros http    ${m.http_req_failed ? (m.http_req_failed.values.rate * 100).toFixed(2) + '%' : '—'}`, '',
  ].join('\n');
}
