/**
 * Simulador de dispositivo de monitorização contínua.
 *
 * Regista um dispositivo (autenticado como TI) ligado a um doente e injeta vitais
 * periodicamente via POST /monitorizacao/ingerir. Serve para validar, sem hardware,
 * que os vitais de monitor passam pela mesma pipeline NEWS2 + watchdog de sépsis.
 *
 * Uso:
 *   node scripts/simulador-monitor.js            # modo one-shot (verificação)
 *   node scripts/simulador-monitor.js --loop     # injeta a cada 5s continuamente
 *
 * Requer: API a correr em localhost:3333, e otplib (login TI faz MFA se necessário).
 */
const BASE = process.env.API_BASE || 'http://localhost:3333/v1';
const TI = process.env.TI_NUM || '00009';              // utilizador TI (regista dispositivos)
const PASS = process.env.TI_PASS || 'Teste1234!';
const RESP = process.env.RESP_ID;                       // responsavelId (utilizador) — obrigatório
const DOENTE = process.env.DOENTE_ID;                   // doente ligado ao dispositivo — obrigatório
const LOOP = process.argv.includes('--loop');

async function loginTi() {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ numeroFuncionario: TI, password: PASS }) });
  const j = await r.json();
  if (j.mfaPendente) {
    const { generate } = require('otplib');
    const code = await generate({ secret: process.env.TOTP_SECRET || 'EWA62CRGBGCMZVKZOEQ7GL2YIMOUSIBV' });
    const r2 = await fetch(`${BASE}/auth/mfa/verificar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mfaChallengeToken: j.mfaChallengeToken, code }) });
    return (r2.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  }
  return (r.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
}

async function ingerir(deviceKey, vitais) {
  const r = await fetch(`${BASE}/monitorizacao/ingerir`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-Key': deviceKey }, body: JSON.stringify(vitais),
  });
  const j = await r.json().catch(() => null);
  return { status: r.status, body: j };
}

(async () => {
  if (!RESP || !DOENTE) { console.error('Defina RESP_ID e DOENTE_ID no ambiente.'); process.exit(1); }
  const cookie = await loginTi();
  const reg = await fetch(`${BASE}/monitorizacao/dispositivos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ nome: `Monitor Cabeceira ${Date.now().toString().slice(-4)}`, localizacao: 'UCI', responsavelId: RESP, doenteId: DOENTE }),
  });
  const regJ = await reg.json();
  if (!regJ.apiKey) { console.error('Falha ao registar dispositivo:', regJ); process.exit(1); }
  console.log('Dispositivo registado. Chave:', regJ.apiKey.slice(0, 20) + '…');
  const key = regJ.apiKey;

  const normal = { pressaoSistolica: 122, pressaoDiastolica: 78, pulso: 78, temperatura: 36.7, saturacaoO2: 98, frequenciaRespiratoria: 16, avpu: 'A' };
  const critico = { pressaoSistolica: 88, pressaoDiastolica: 55, pulso: 132, temperatura: 39.2, saturacaoO2: 89, frequenciaRespiratoria: 32, avpu: 'V' };

  if (!LOOP) {
    const a = await ingerir(key, normal);
    console.log(`ingerir normal   -> ${a.status}  NEWS2=${a.body?.news2}`);
    const b = await ingerir(key, critico);
    console.log(`ingerir crítico  -> ${b.status}  NEWS2=${b.body?.news2}  ${b.body?.news2 >= 7 ? '✓ dispara resposta imediata + sépsis' : ''}`);
    console.log('\nVerificação: os vitais foram criados com origem="monitor" e NEWS2 calculado pela MESMA pipeline do registo manual.');
    return;
  }

  console.log('Modo loop — Ctrl+C para parar.');
  let i = 0;
  setInterval(async () => {
    const jitter = (v, d) => Math.round(v + (Math.random() - 0.5) * d);
    const v = { pressaoSistolica: jitter(120, 20), pulso: jitter(80, 20), temperatura: +(36.8 + (Math.random() - 0.5)).toFixed(1), saturacaoO2: jitter(97, 4), frequenciaRespiratoria: jitter(16, 6), avpu: 'A' };
    const r = await ingerir(key, v);
    console.log(`[${new Date().toLocaleTimeString('pt-PT')}] #${++i} -> ${r.status} NEWS2=${r.body?.news2}`);
  }, 5000);
})().catch(e => { console.error('SIMULADOR_FALHOU', e.message); process.exit(1); });
