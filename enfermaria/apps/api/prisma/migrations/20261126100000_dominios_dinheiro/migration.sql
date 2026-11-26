-- ARQ-22 — modelação do schema.

-- 1. Dinheiro em Decimal(12,2) em vez de Float (0,1 + 0,2 ≠ 0,3 em vírgula flutuante).
ALTER TABLE "stock_items" ALTER COLUMN "precoUnitario" TYPE DECIMAL(12,2) USING ROUND("precoUnitario"::numeric, 2);
ALTER TABLE "encomendas_fornecedor" ALTER COLUMN "precoUnitario" TYPE DECIMAL(12,2) USING ROUND("precoUnitario"::numeric, 2);
ALTER TABLE "itens_fatura" ALTER COLUMN "precoUnitario" TYPE DECIMAL(12,2) USING ROUND("precoUnitario"::numeric, 2);
ALTER TABLE "itens_fatura" ALTER COLUMN "total" TYPE DECIMAL(12,2) USING ROUND("total"::numeric, 2);
ALTER TABLE "episodios_faturacao" ALTER COLUMN "totalBase" TYPE DECIMAL(12,2) USING ROUND("totalBase"::numeric, 2);
ALTER TABLE "episodios_faturacao" ALTER COLUMN "totalCobrado" TYPE DECIMAL(12,2) USING ROUND("totalCobrado"::numeric, 2);
ALTER TABLE "pagamentos" ALTER COLUMN "valor" TYPE DECIMAL(12,2) USING ROUND("valor"::numeric, 2);
ALTER TABLE "atos_clinicos" ALTER COLUMN "precoBase" TYPE DECIMAL(12,2) USING ROUND("precoBase"::numeric, 2);
ALTER TABLE "atos_consulta" ALTER COLUMN "precoUnitario" TYPE DECIMAL(12,2) USING ROUND("precoUnitario"::numeric, 2);

-- 2. Valores permitidos dos campos de estado/tipo em texto (fonte: libs/shared/src/lib/dominios.ts).
-- NOT VALID: vale para todas as escritas a partir de agora sem falhar a migração por linhas
-- antigas; depois de corrigir dados antigos, `ALTER TABLE … VALIDATE CONSTRAINT …`.
ALTER TABLE "passagens_turno" ADD CONSTRAINT "ck_passagens_turno_estadodesafio" CHECK ("estadoDesafio" IN ('pendente', 'aceite', 'expirado')) NOT VALID;
ALTER TABLE "medicacoes" ADD CONSTRAINT "ck_medicacoes_estadovalidacao" CHECK ("estadoValidacao" IN ('pendente', 'pendente_medico', 'aprovada', 'rejeitada')) NOT VALID;
ALTER TABLE "registos_dotacao" ADD CONSTRAINT "ck_registos_dotacao_turno" CHECK ("turno" IN ('manha', 'tarde', 'noite')) NOT VALID;
ALTER TABLE "registos_dotacao" ADD CONSTRAINT "ck_registos_dotacao_semaforo" CHECK ("semaforo" IN ('verde', 'amarelo', 'vermelho', 'sem_doentes')) NOT VALID;
ALTER TABLE "laudos_radiologicos" ADD CONSTRAINT "ck_laudos_radiologicos_estado" CHECK ("estado" IN ('rascunho', 'assinado')) NOT VALID;
ALTER TABLE "transferencias_stock" ADD CONSTRAINT "ck_transferencias_stock_estado" CHECK ("estado" IN ('pendente', 'confirmada', 'cancelada')) NOT VALID;
ALTER TABLE "encomendas_fornecedor" ADD CONSTRAINT "ck_encomendas_fornecedor_estado" CHECK ("estado" IN ('pendente', 'recebida', 'parcial', 'cancelada')) NOT VALID;
ALTER TABLE "tickets" ADD CONSTRAINT "ck_tickets_tipo" CHECK ("tipo" IN ('admissao', 'consulta', 'faturacao', 'farmacia', 'exames', 'urgencia', 'geral')) NOT VALID;
ALTER TABLE "tickets" ADD CONSTRAINT "ck_tickets_estado" CHECK ("estado" IN ('aguarda', 'chamado', 'em_atendimento', 'concluido', 'desistiu')) NOT VALID;
ALTER TABLE "tickets" ADD CONSTRAINT "ck_tickets_prioridade" CHECK ("prioridade" IN ('normal', 'prioritario', 'senior')) NOT VALID;
ALTER TABLE "trocas_folga" ADD CONSTRAINT "ck_trocas_folga_estado" CHECK ("estado" IN ('pendente', 'aceite', 'recusado', 'aprovado', 'cancelado')) NOT VALID;
ALTER TABLE "sessoes_especialidade" ADD CONSTRAINT "ck_sessoes_especialidade_estado" CHECK ("estado" IN ('agendada', 'realizada', 'cancelada', 'faltou')) NOT VALID;
ALTER TABLE "avaliacoes_desempenho" ADD CONSTRAINT "ck_avaliacoes_desempenho_estado" CHECK ("estado" IN ('rascunho', 'finalizada', 'assinada')) NOT VALID;
ALTER TABLE "consentimentos_informados" ADD CONSTRAINT "ck_consentimentos_informados_tipo" CHECK ("tipo" IN ('cirurgia', 'procedimento_invasivo', 'anestesia', 'transfusao', 'outro')) NOT VALID;
ALTER TABLE "protocolos_clinicos" ADD CONSTRAINT "ck_protocolos_clinicos_tipo" CHECK ("tipo" IN ('sepsis', 'avc', 'iamcst', 'outro')) NOT VALID;
ALTER TABLE "protocolos_clinicos" ADD CONSTRAINT "ck_protocolos_clinicos_estadogeral" CHECK ("estadoGeral" IN ('ativo', 'concluido', 'cancelado')) NOT VALID;
ALTER TABLE "prescricoes_dieta" ADD CONSTRAINT "ck_prescricoes_dieta_tipo" CHECK ("tipo" IN ('normal', 'hipocalorica', 'diabetica', 'renal', 'hepatica', 'liquida', 'jejum', 'outra')) NOT VALID;
ALTER TABLE "referenciacoes_continuidade" ADD CONSTRAINT "ck_referenciacoes_continuidade_estado" CHECK ("estado" IN ('proposta', 'enviada', 'aceite', 'vaga_atribuida', 'recusada', 'cancelada')) NOT VALID;
ALTER TABLE "gravidezes" ADD CONSTRAINT "ck_gravidezes_estado" CHECK ("estado" IN ('ativa', 'concluida', 'interrompida')) NOT VALID;
ALTER TABLE "partos" ADD CONSTRAINT "ck_partos_tipo" CHECK ("tipo" IN ('eutocico', 'cesariana', 'ventosa', 'forceps')) NOT VALID;
ALTER TABLE "planos_quimioterapia" ADD CONSTRAINT "ck_planos_quimioterapia_estado" CHECK ("estado" IN ('ativo', 'concluido', 'suspenso')) NOT VALID;
ALTER TABLE "ciclos_quimioterapia" ADD CONSTRAINT "ck_ciclos_quimioterapia_estado" CHECK ("estado" IN ('agendado', 'administrado', 'adiado', 'cancelado')) NOT VALID;
ALTER TABLE "sessoes_dialise" ADD CONSTRAINT "ck_sessoes_dialise_modalidade" CHECK ("modalidade" IN ('hemodialise', 'dialise_peritoneal')) NOT VALID;
ALTER TABLE "sessoes_dialise" ADD CONSTRAINT "ck_sessoes_dialise_acessovascular" CHECK ("acessoVascular" IN ('fistula', 'cateter', 'protese')) NOT VALID;
