/**
 * ARQ-22 — valores permitidos dos campos de estado/tipo guardados como texto.
 *
 * Estes campos são `String` no schema (um `enum` do Prisma mudaria os tipos de centenas de
 * linhas), e os valores só existiam num comentário — que já divergia do código (o quiosque
 * enviava "faturacao", "geral" e "senior", que o DTO recusava; a dieta "diabetica" estava
 * documentada como "diab"; "pendente_medico" não constava). A fonte única passa a ser esta:
 *
 * - os DTOs validam com estas listas (`@IsIn`);
 * - a base de dados tem um CHECK com os mesmos valores (migração `..._dominios_dinheiro`);
 * - um teste estrutural compara esta lista com o CHECK e com o comentário do schema.
 *
 * Acrescentar um valor: aqui, numa nova migração (DROP/ADD do CHECK) e no comentário do schema.
 */
import { LETRA_SENHA } from './senhas.js';

export const TIPOS_SENHA = Object.keys(LETRA_SENHA) as readonly string[];
export const PRIORIDADES_SENHA = ['normal', 'prioritario', 'senior'] as const;
export const ESTADOS_SENHA = ['aguarda', 'chamado', 'em_atendimento', 'concluido', 'desistiu'] as const;

export const TIPOS_CONSENTIMENTO_INFORMADO = ['cirurgia', 'procedimento_invasivo', 'anestesia', 'transfusao', 'outro'] as const;
export const TIPOS_PROTOCOLO_CLINICO = ['sepsis', 'avc', 'iamcst', 'outro'] as const;
export const TIPOS_DIETA = ['normal', 'hipocalorica', 'diabetica', 'renal', 'hepatica', 'liquida', 'jejum', 'outra'] as const;

/** `Modelo.campo` → valores permitidos. Cada entrada tem um CHECK na base de dados. */
export const DOMINIOS: Record<string, readonly string[]> = {
  'PassagemTurno.estadoDesafio': ['pendente', 'aceite', 'expirado'],
  'Medicacao.estadoValidacao': ['pendente', 'pendente_medico', 'aprovada', 'rejeitada'],
  'RegistoDotacao.turno': ['manha', 'tarde', 'noite'],
  'RegistoDotacao.semaforo': ['verde', 'amarelo', 'vermelho', 'sem_doentes'],
  'LaudoRadiologico.estado': ['rascunho', 'assinado'],
  'TransferenciaStock.estado': ['pendente', 'confirmada', 'cancelada'],
  'EncomendaFornecedor.estado': ['pendente', 'recebida', 'parcial', 'cancelada'],
  'Ticket.tipo': TIPOS_SENHA,
  'Ticket.estado': ESTADOS_SENHA,
  'Ticket.prioridade': PRIORIDADES_SENHA,
  'TrocaFolga.estado': ['pendente', 'aceite', 'recusado', 'aprovado', 'cancelado'],
  'SessaoEspecialidade.estado': ['agendada', 'realizada', 'cancelada', 'faltou'],
  'AvaliacaoDesempenho.estado': ['rascunho', 'finalizada', 'assinada'],
  'ConsentimentoInformado.tipo': TIPOS_CONSENTIMENTO_INFORMADO,
  'ProtocoloClinico.tipo': TIPOS_PROTOCOLO_CLINICO,
  'ProtocoloClinico.estadoGeral': ['ativo', 'concluido', 'cancelado'],
  'PrescricaoDieta.tipo': TIPOS_DIETA,
  'ReferenciacaoContinuidade.estado': ['proposta', 'enviada', 'aceite', 'vaga_atribuida', 'recusada', 'cancelada'],
  'Gravidez.estado': ['ativa', 'concluida', 'interrompida'],
  'Parto.tipo': ['eutocico', 'cesariana', 'ventosa', 'forceps'],
  'PlanoQuimioterapia.estado': ['ativo', 'concluido', 'suspenso'],
  'CicloQuimioterapia.estado': ['agendado', 'administrado', 'adiado', 'cancelado'],
  'SessaoDialise.modalidade': ['hemodialise', 'dialise_peritoneal'],
  'SessaoDialise.acessoVascular': ['fistula', 'cateter', 'protese'],
};
