// Utilitários partilhados pelos testes de carga (k6).
//
// PERF-09: os testes antigos entravam como direção (sem MFA) e só liam `/doentes?limit=20` —
// o caminho mais barato da listagem, sem o filtro de atribuição que os clínicos pagam — e nem
// escreviam nem abriam o WebSocket, ao contrário do que o workflow anunciava. Aqui ficam o
// login com MFA (TOTP calculado em k6), o CSRF para as escritas e a ligação Socket.IO.
import http from 'k6/http';
import ws from 'k6/ws';
import crypto from 'k6/crypto';
import { check, fail } from 'k6';

export const BASE = __ENV.BASE_URL || 'http://localhost:3333';
export const PASS = __ENV.LOGIN_PASS || 'Teste1234!';
// Segredo TOTP fixo das contas de TESTE (seed-test-users.ts) — nunca o de uma conta real.
const TOTP_SECRET = __ENV.TEST_TOTP_SECRET || 'EWA62CRGBGCMZVKZOEQ7GL2YIMOUSIBV';
const JSON_H = { 'Content-Type': 'application/json' };

function base32(s) {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const i = alfabeto.indexOf(c);
    if (i >= 0) bits += i.toString(2).padStart(5, '0');
  }
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out.buffer;
}

/** RFC 6238 (SHA1, 30 s, 6 dígitos). */
export function totp(segredo = TOTP_SECRET, agora = Date.now()) {
  let contador = Math.floor(agora / 30000);
  const msg = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) { msg[i] = contador & 0xff; contador = Math.floor(contador / 256); }
  const h = new Uint8Array(crypto.hmac('sha1', base32(segredo), msg.buffer, 'binary'));
  const o = h[h.length - 1] & 0xf;
  const codigo = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(codigo % 1000000).padStart(6, '0');
}

/**
 * Entra como `numero` (com MFA, se a conta o pedir) e devolve os cookies da sessão e o CSRF,
 * para cada VU os repor no seu jar. Corre no `setup()` — um login por utilizador e por teste
 * (o anti-replay do TOTP recusa o mesmo código duas vezes para a mesma conta).
 */
export function entrar(numero) {
  // Os cookies vêm dos `Set-Cookie` de cada resposta e não do jar: em NODE_ENV=production levam
  // a flag Secure e o jar do k6 não os devolveria por http (o teste corre sem TLS).
  const cookies = {};
  const guardar = (r) => {
    for (const [nome, valores] of Object.entries(r.cookies || {})) if (valores[0]) cookies[nome] = valores[0].value;
    usarSessao({ cookies });
    return r;
  };
  http.cookieJar().clear(BASE);
  guardar(http.get(`${BASE}/v1/csrf-token`));
  const r = guardar(http.post(`${BASE}/v1/auth/login`, JSON.stringify({ numeroFuncionario: numero, password: PASS }), { headers: JSON_H, tags: { tipo: 'login' } }));
  if (!check(r, { [`login ${numero}`]: (x) => x.status === 201 || x.status === 200 })) fail(`login ${numero}: ${r.status} ${r.body}`);
  const corpo = r.json();
  if (corpo && corpo.mfaPendente) {
    const m = guardar(http.post(`${BASE}/v1/auth/mfa/verificar`, JSON.stringify({ mfaChallengeToken: corpo.mfaChallengeToken, code: totp() }), { headers: JSON_H, tags: { tipo: 'login' } }));
    if (!check(m, { [`mfa ${numero}`]: (x) => x.status === 201 || x.status === 200 })) fail(`mfa ${numero}: ${m.status} ${m.body}`);
  }
  guardar(http.get(`${BASE}/v1/csrf-token`));
  if (!cookies['csrf-token']) fail(`login ${numero}: sem cookie csrf-token`);
  return { cookies, csrf: cookies['csrf-token'] };
}

/** Repõe a sessão no jar do VU (sem a flag Secure — o teste corre em http). */
export function usarSessao(sessao) {
  const jar = http.cookieJar();
  for (const [nome, valor] of Object.entries(sessao.cookies)) jar.set(BASE, nome, valor);
}

export const get = (caminho, tipo) => http.get(`${BASE}/v1${caminho}`, { tags: { tipo } });
export const post = (sessao, caminho, corpo, tipo) =>
  http.post(`${BASE}/v1${caminho}`, JSON.stringify(corpo), { headers: { ...JSON_H, 'x-csrf-token': sessao.csrf }, tags: { tipo } });

/**
 * Abre o Socket.IO do namespace /ws com um bilhete (como a web faz), espera pela confirmação do
 * namespace e mantém a ligação `segundos`, a responder aos pings. Devolve se ligou.
 */
export function ligarSocket(segundos = 5) {
  const bilhete = get('/auth/socket-ticket', 'leitura');
  if (bilhete.status !== 200) return false;
  const token = bilhete.json('ticket');
  const url = BASE.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket';
  let ligado = false;
  const res = ws.connect(url, {}, (socket) => {
    socket.on('message', (m) => {
      if (m.startsWith('0')) socket.send('40/ws,' + JSON.stringify({ token })); // handshake engine.io → entrar no namespace
      else if (m === '2') socket.send('3'); // ping → pong
      else if (m.startsWith('40/ws')) ligado = true;
      else if (m.startsWith('44/ws') || m.startsWith('41/ws')) socket.close();
    });
    socket.setTimeout(() => socket.close(), segundos * 1000);
  });
  check(res, { 'ws 101': (r) => r && r.status === 101 });
  return ligado;
}
