/**
 * UX-27 — "O que há de novo". A entrada mais recente fica no topo; o `id` é o que se guarda
 * como "já visto" para mostrar o sinal no menu "?". Os textos são curtos e dizem o que mudou
 * para quem usa — não como foi feito.
 */
export interface Novidade { id: string; data: string; pt: { titulo: string; itens: string[] }; en: { titulo: string; itens: string[] } }

export const NOVIDADES: Novidade[] = [
  {
    id: '2026-11-b', data: '2026-11-26',
    pt: {
      titulo: 'Segurança no posto e avaliações que geram tarefas',
      itens: [
        'Bloquear o posto (botão na barra ou Ctrl+Shift+L) e aviso 2 minutos antes de a sessão terminar; as notas a meio não se perdem.',
        'NRS-2002, Barthel, FOIS, Morse e Braden passam a criar a tarefa certa (nutrição, planeamento da alta, deglutição, prevenção).',
        'Na receção: utente não identificado, NIF validado e aviso de possíveis duplicados.',
        'Visita guiada por papel e "Primeiros passos" — abra-os aqui, no menu "?".',
      ],
    },
    en: {
      titulo: 'Workstation security and assessments that create tasks',
      itens: [
        'Lock the workstation (top bar button or Ctrl+Shift+L) and a warning 2 minutes before the session ends; unsaved notes are kept.',
        'NRS-2002, Barthel, FOIS, Morse and Braden now create the right task (nutrition, discharge planning, swallowing, prevention).',
        'At reception: unidentified patients, validated tax number and possible-duplicate warnings.',
        'Role-based guided tour and "First steps" — open them here, in the "?" menu.',
      ],
    },
  },
  {
    id: '2026-11-a', data: '2026-11-22',
    pt: {
      titulo: 'Turnos, sinais vitais e pesquisa rápida',
      itens: [
        'Uma só definição de turnos em todos os ecrãs (manhã 08–16, tarde 16–24, noite 00–08), com 30 minutos de passagem.',
        'NEWS2 previsto enquanto regista os sinais vitais, com os valores fora do normal destacados.',
        'Pesquisa rápida (Ctrl+K) com as ações do doente aberto e atalhos de uma tecla na ficha (V, M, N…).',
      ],
    },
    en: {
      titulo: 'Shifts, vital signs and quick search',
      itens: [
        'One shift definition across all screens (morning 08–16, afternoon 16–24, night 00–08), with a 30-minute handover.',
        'Predicted NEWS2 while you record vital signs, with abnormal values highlighted.',
        'Quick search (Ctrl+K) with actions for the open patient and one-key shortcuts in the patient file (V, M, N…).',
      ],
    },
  },
];

export const NOVIDADE_MAIS_RECENTE = NOVIDADES[0]?.id ?? null;
