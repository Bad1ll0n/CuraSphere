// k6 rampa — os mesmos cenários do smoke (turno, supervisão, tempo real), a subir por degraus para
// encontrar onde a latência degrada.  Corre:  k6 run load/ramp.js   (ajusta os alvos ao ambiente)
import { setup as preparar, turno, supervisao, tempoReal, handleSummary as resumo } from './smoke.js';

export const options = {
  scenarios: {
    turno: {
      executor: 'ramping-vus', exec: 'turno', startVUs: 0, gracefulRampDown: '10s',
      stages: [
        { duration: '30s', target: 10 }, // aquecer
        { duration: '1m', target: 25 }, // carga nominal (um serviço em hora de registos)
        { duration: '1m', target: 50 }, // pico
        { duration: '30s', target: 0 }, // arrefecer
      ],
    },
    supervisao: { executor: 'constant-vus', exec: 'supervisao', vus: 3, duration: '3m' },
    tempo_real: { executor: 'ramping-vus', exec: 'tempoReal', startVUs: 0, stages: [{ duration: '1m', target: 20 }, { duration: '2m', target: 40 }] },
  },
  thresholds: {
    checks: ['rate>0.98'],
    http_req_failed: ['rate<0.02'],
    'http_req_duration{tipo:leitura}': ['p(95)<800', 'p(99)<1500'],
    'http_req_duration{tipo:pesquisa}': ['p(95)<1000'],
    'http_req_duration{tipo:escrita}': ['p(95)<1200'],
    ws_ligou: ['rate>0.98'],
  },
};

export const setup = preparar;
export { turno, supervisao, tempoReal };
export function handleSummary(d) { return resumo(d); }
