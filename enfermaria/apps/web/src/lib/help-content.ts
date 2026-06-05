export const HELP: Record<string, { titulo: string; descricao: string }> = {
  news2: {
    titulo: 'NEWS2 — National Early Warning Score 2',
    descricao: 'Score 0–20 baseado em 7 parâmetros fisiológicos. Score ≥5 = monitorização urgente a cada 4h e resposta clínica. Score ≥7 = monitorização contínua e resposta imediata. Calculado automaticamente ao registar sinais vitais.',
  },
  baseline: {
    titulo: 'Baseline Individual',
    descricao: 'Média ± desvio padrão calculados a partir dos últimos 20 sinais vitais do doente. Requer mínimo de 8 registos. ⚠ indica desvio superior a 2 desvios padrão — pode ser clinicamente significativo.',
  },
  braden: {
    titulo: 'Escala de Braden — Risco de Úlcera de Pressão',
    descricao: '6 subescalas (percepção sensorial, humidade, actividade, mobilidade, nutrição, fricção). Score total: 6–23. ≤9 = risco muito alto; 10–12 = alto; 13–14 = moderado; 15–18 = baixo. Activar protocolo de prevenção se ≤12.',
  },
  glasgow: {
    titulo: 'Escala de Glasgow — Nível de Consciência',
    descricao: '3 componentes: abertura ocular (1–4), resposta verbal (1–5), resposta motora (1–6). Total 3–15. 15 = normal; 9–14 = lesão moderada; 3–8 = coma grave — considerar protecção de via aérea.',
  },
  morse: {
    titulo: 'Escala de Morse — Risco de Queda',
    descricao: '6 itens (quedas anteriores, diagnósticos secundários, apoio ambulatório, terapia EV, marcha, estado mental). ≥45 = alto risco; 25–44 = médio; <25 = baixo. Implementar medidas de prevenção se ≥25.',
  },
  qsofa: {
    titulo: 'qSOFA — Quick Sequential Organ Failure Assessment',
    descricao: '3 critérios: FR≥22/min (+1), PA sistólica≤100mmHg (+1), alteração do estado mental (+1). Score ≥2 = suspeita de sépsis — iniciar avaliação e colheita de hemoculturas.',
  },
  sirs: {
    titulo: 'SIRS — Síndrome de Resposta Inflamatória Sistémica',
    descricao: 'Temperatura >38°C ou <36°C (+1), FC>90/min (+1), FR>20/min (+1), Leucócitos >12.000 ou <4.000 (+1). Score ≥2 = SIRS. Em contexto de infecção suspeita ou confirmada, considerar sépsis.',
  },
  balanco_hidrico: {
    titulo: 'Balanço Hídrico',
    descricao: 'Diferença entre entradas (EV, oral, SNG) e saídas (urina, drenos, vómitos, fezes). Balanço positivo >2L/24h pode indicar sobrecarga hídrica. Negativo >2L/24h indica necessidade de reposição.',
  },
  sepsis_bundle: {
    titulo: 'Bundle de Sépsis — 4 Acções Críticas',
    descricao: '4 acções nas primeiras horas (SEP-1): 1. Hemoculturas antes de antibióticos 2. Antibióticos de largo espectro 3. Medição de lactato 4. Fluidoterapia se PA≤65mmHg ou lactato≥4mmol/L. Cada hora de atraso aumenta mortalidade ~7%.',
  },
  plano_alta: {
    titulo: 'Plano de Alta — Critérios de Readiness',
    descricao: '8 critérios clínicos para alta segura: afebril 24h, mobilidade adequada, tolerância oral, dores controladas, família informada, transporte assegurado, medicação preparada e consulta de seguimento marcada.',
  },
  risco_score: {
    titulo: 'Score de Risco de Deterioração',
    descricao: 'Score 0–100 calculado a partir de: NEWS2 actual, tendência NEWS2 (últimas 3 leituras), desvios de baseline, alertas de sépsis, sinalizações activas e tempo desde último registo de SV. Verde <30 | Âmbar 30–60 | Vermelho >60.',
  },
  ai_clinico: {
    titulo: 'Apoio à Decisão Clínica (IA)',
    descricao: 'Análise dos dados clínicos do doente por modelo de linguagem. Identifica padrões e tendências nos sinais vitais, interacções medicamentosas e alertas pendentes. IMPORTANTE: apoio à decisão apenas — não substitui avaliação clínica. Médico vê sugestões de investigação; enfermeiro vê observações de sinais vitais.',
  },
};
