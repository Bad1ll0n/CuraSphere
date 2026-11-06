-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Servico" AS ENUM ('internamento', 'urgencia', 'bloco_operatorio', 'consultas_externas', 'farmacia', 'fisioterapia', 'transporte', 'administrativo');

-- CreateEnum
CREATE TYPE "EstadoCama" AS ENUM ('livre', 'ocupada', 'em_limpeza', 'reservada');

-- CreateEnum
CREATE TYPE "EstadoDoente" AS ENUM ('estavel', 'grave', 'critico', 'alta_prevista');

-- CreateEnum
CREATE TYPE "TipoTurno" AS ENUM ('manha', 'tarde', 'noite');

-- CreateEnum
CREATE TYPE "TipoEscalaClinica" AS ENUM ('RASS', 'CPOT', 'SOFA', 'CTG', 'Apgar', 'PEWS', 'FLACC', 'Barthel', 'FIM', 'MRC', 'FOIS', 'NRS2002', 'PHQ9', 'GAD7', 'Glasgow');

-- CreateEnum
CREATE TYPE "TipoTarefa" AS ENUM ('clinica', 'logistica');

-- CreateEnum
CREATE TYPE "PrioridadeTarefa" AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- CreateEnum
CREATE TYPE "EstadoTarefa" AS ENUM ('pendente', 'em_progresso', 'concluida', 'cancelada');

-- CreateEnum
CREATE TYPE "EstadoPedidoTroca" AS ENUM ('pendente_destinatario', 'pendente_chefe', 'aprovado', 'rejeitado');

-- CreateEnum
CREATE TYPE "TipoExame" AS ENUM ('analise_clinica', 'rx', 'eco', 'tc', 'rmn', 'ecg', 'outro');

-- CreateEnum
CREATE TYPE "EstadoExame" AS ENUM ('solicitado', 'em_progresso', 'resultado_disponivel', 'cancelado');

-- CreateEnum
CREATE TYPE "CorTriagem" AS ENUM ('vermelho', 'laranja', 'amarelo', 'verde', 'azul');

-- CreateEnum
CREATE TYPE "EstadoEpisodio" AS ENUM ('triagem', 'sala_espera', 'em_atendimento', 'alta_urgencia', 'internado', 'transferido');

-- CreateEnum
CREATE TYPE "EstadoCirurgia" AS ENUM ('agendada', 'em_curso', 'concluida', 'cancelada', 'adiada');

-- CreateEnum
CREATE TYPE "EstadoConsulta" AS ENUM ('agendada', 'realizada', 'faltou', 'cancelada');

-- CreateEnum
CREATE TYPE "EstadoCheckin" AS ENUM ('aguardando', 'em_atendimento', 'atendido', 'desistiu', 'ausente');

-- CreateEnum
CREATE TYPE "TipoStock" AS ENUM ('medicamento', 'material', 'consumivel');

-- CreateEnum
CREATE TYPE "EstadoPedidoFarmacia" AS ENUM ('pendente', 'aprovado', 'rejeitado', 'dispensado', 'cancelado');

-- CreateEnum
CREATE TYPE "EstadoSessao" AS ENUM ('agendada', 'realizada', 'cancelada', 'faltou');

-- CreateEnum
CREATE TYPE "TipoPedidoInterno" AS ENUM ('transporte', 'esterilizacao', 'equipamento', 'limpeza');

-- CreateEnum
CREATE TYPE "EstadoPedidoInterno" AS ENUM ('pendente', 'em_curso', 'concluido', 'cancelado');

-- CreateEnum
CREATE TYPE "EstadoInterconsulta" AS ENUM ('pendente', 'aceite', 'respondida', 'cancelada');

-- CreateEnum
CREATE TYPE "TipoDispositivoInvasivo" AS ENUM ('cateter_venoso_central', 'cateter_venoso_periferico', 'cateter_arterial', 'sonda_vesical', 'tubo_orotaqueal', 'traqueostomia', 'dreno_toracico', 'sonda_nasogastrica', 'linha_epidural', 'outro');

-- CreateEnum
CREATE TYPE "TipoIncidenteTI" AS ENUM ('infraestrutura', 'rede', 'his_erp', 'base_dados', 'seguranca', 'dados_clinicos', 'outro');

-- CreateEnum
CREATE TYPE "EstadoIncidenteTI" AS ENUM ('aberto', 'em_analise', 'resolvido', 'fechado');

-- CreateEnum
CREATE TYPE "PrioridadeIncidenteTI" AS ENUM ('baixa', 'media', 'alta', 'critica');

-- CreateEnum
CREATE TYPE "TipoPedidoTI" AS ENUM ('listagem_dados', 'relatorio', 'acesso_sistema', 'backup', 'auditoria_dados', 'outro');

-- CreateEnum
CREATE TYPE "EstadoPedidoTI" AS ENUM ('pendente', 'em_curso', 'concluido', 'recusado');

-- CreateEnum
CREATE TYPE "EstadoFatura" AS ENUM ('pendente', 'emitida', 'paga', 'isenta', 'anulada');

-- CreateEnum
CREATE TYPE "ResultadoCultura" AS ENUM ('pendente', 'positivo', 'negativo', 'contaminado');

-- CreateEnum
CREATE TYPE "EstadoSurto" AS ENUM ('activo', 'controlado', 'encerrado');

-- CreateTable
CREATE TABLE "roles_config" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "roles_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subroles_config" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "roleChave" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "subroles_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilizadores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "numeroFuncionario" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mfaSecret" TEXT,
    "mfaAtivo" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretPendente" TEXT,
    "versaoSessao" INTEGER NOT NULL DEFAULT 0,
    "passwordExpiresAt" TIMESTAMP(3),
    "tentativasLoginFalhadas" INTEGER NOT NULL DEFAULT 0,
    "ultimaFalhaLoginEm" TIMESTAMP(3),
    "bloqueadoAte" TIMESTAMP(3),
    "role" TEXT NOT NULL,
    "subRole" TEXT,
    "servico" "Servico" NOT NULL DEFAULT 'internamento',
    "ordemExperiencia" INTEGER,
    "equipa" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "chefeId" TEXT,

    CONSTRAINT "utilizadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "numero" TEXT NOT NULL,
    "quarto" TEXT NOT NULL,
    "estado" "EstadoCama" NOT NULL DEFAULT 'livre',
    "servico" TEXT,
    "piso" INTEGER,

    CONSTRAINT "camas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doentes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "nome" TEXT NOT NULL,
    "nomeBusca" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "numeroProcesso" TEXT NOT NULL,
    "estado" "EstadoDoente" NOT NULL DEFAULT 'estavel',
    "diagnosticoPrincipal" TEXT,
    "icd10Code" TEXT,
    "grupoSanguineo" TEXT,
    "estadoRegisto" TEXT NOT NULL DEFAULT 'pendente_cama',
    "tipoVisita" TEXT,
    "dataAdmissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataAltaPrevista" TIMESTAMP(3),
    "dataAlta" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "emIsolamento" BOOLEAN NOT NULL DEFAULT false,
    "motivoIsolamento" TEXT,
    "deletedAt" TIMESTAMP(3),
    "fotoUrl" TEXT,
    "camaId" TEXT,
    "administrativoAdmissaoId" TEXT,

    CONSTRAINT "doentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos" (
    "id" TEXT NOT NULL,
    "tipo" "TipoTurno" NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "chefeTurnoId" TEXT NOT NULL,

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atribuicoes_doente" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "enfermeiroId" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,

    CONSTRAINT "atribuicoes_doente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_entrada" (
    "id" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "checkInEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passagemTurnoVista" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "horarios_entrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passagens_turno" (
    "id" TEXT NOT NULL,
    "turnoAnteriorId" TEXT NOT NULL,
    "turnoAtualId" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "estadoDesafio" TEXT NOT NULL DEFAULT 'pendente',
    "desafioEnviadoEm" TIMESTAMP(3),
    "desafioAceitoEm" TIMESTAMP(3),
    "desafioExpiradoEm" TIMESTAMP(3),

    CONSTRAINT "passagens_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presenca_online" (
    "id" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "socketId" TEXT NOT NULL,
    "ligadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoPing" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presenca_online_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registos_checkin" (
    "id" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "turnoId" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "distanciaHospital" DOUBLE PRECISION,
    "dentroGeofence" BOOLEAN NOT NULL DEFAULT true,
    "ip" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registos_checkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_clinicas" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "subjetivo" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "avaliacao" TEXT NOT NULL,
    "plano" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadaEm" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "assinadaEm" TIMESTAMP(3),
    "assinadaPorId" TEXT,

    CONSTRAINT "notas_clinicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_clinicas_adendas" (
    "id" TEXT NOT NULL,
    "notaClinicaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "motivo" VARCHAR(500) NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_clinicas_adendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalas_clinicas" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "registadoPorId" TEXT NOT NULL,
    "tipo" "TipoEscalaClinica" NOT NULL,
    "valores" JSONB NOT NULL,
    "pontuacao" INTEGER,
    "classificacao" TEXT,
    "observacoes" TEXT,
    "registadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalas_clinicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_turno" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "turnoId" TEXT,
    "doenteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,

    CONSTRAINT "notas_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefas" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" "TipoTarefa" NOT NULL,
    "prioridade" "PrioridadeTarefa" NOT NULL DEFAULT 'media',
    "estado" "EstadoTarefa" NOT NULL DEFAULT 'pendente',
    "prazo" TIMESTAMP(3),
    "transitouDeTurno" BOOLEAN NOT NULL DEFAULT false,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidaEm" TIMESTAMP(3),
    "doenteId" TEXT NOT NULL,
    "responsavelId" TEXT,
    "grupoResponsavel" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "turnoId" TEXT,

    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicacoes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "nome" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "frequencia" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadoEm" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "doenteId" TEXT NOT NULL,
    "prescritoPorId" TEXT NOT NULL,
    "estadoValidacao" TEXT,
    "validadoPorId" TEXT,
    "validadaEm" TIMESTAMP(3),
    "motivoRejeicao" TEXT,
    "assinadoEm" TIMESTAMP(3),
    "assinadoPorId" TEXT,
    "overrideAlergia" BOOLEAN NOT NULL DEFAULT false,
    "overrideMotivo" VARCHAR(1000),
    "overrideAlergenioId" TEXT,

    CONSTRAINT "medicacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stewardship_antibiotico" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "medicacaoId" TEXT NOT NULL,
    "diasTerapia" INTEGER NOT NULL DEFAULT 0,
    "categoria" TEXT NOT NULL,
    "alertaEmitido" BOOLEAN NOT NULL DEFAULT false,
    "sugestaoIA" TEXT,
    "aprovadoPor" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stewardship_antibiotico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registos_medicacao" (
    "id" TEXT NOT NULL,
    "administradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,
    "verificacao5Certas" BOOLEAN NOT NULL DEFAULT false,
    "certosVerificados" JSONB,
    "naoAdministrada" BOOLEAN NOT NULL DEFAULT false,
    "motivoNaoAdmin" TEXT,
    "deletedAt" TIMESTAMP(3),
    "medicacaoId" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "administradoPorId" TEXT NOT NULL,

    CONSTRAINT "registos_medicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalas" (
    "id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadaPorId" TEXT NOT NULL,

    CONSTRAINT "escalas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_turno" (
    "id" TEXT NOT NULL,
    "tipo" "TipoTurno" NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "escalId" TEXT NOT NULL,

    CONSTRAINT "horarios_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_turno_profissionais" (
    "horarioTurnoId" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,

    CONSTRAINT "horarios_turno_profissionais_pkey" PRIMARY KEY ("horarioTurnoId","utilizadorId")
);

-- CreateTable
CREATE TABLE "pedidos_troca_turno" (
    "id" TEXT NOT NULL,
    "estado" "EstadoPedidoTroca" NOT NULL DEFAULT 'pendente_destinatario',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoEm" TIMESTAMP(3),
    "solicitanteId" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "aprovadoPorId" TEXT,

    CONSTRAINT "pedidos_troca_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atribuicoes_horario_turno" (
    "id" TEXT NOT NULL,
    "horarioTurnoId" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "atribuidoPorId" TEXT NOT NULL,

    CONSTRAINT "atribuicoes_horario_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sinais_vitais" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "registadoPorId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pressaoSistolica" INTEGER,
    "pressaoDiastolica" INTEGER,
    "pulso" INTEGER,
    "temperatura" DOUBLE PRECISION,
    "saturacaoO2" INTEGER,
    "frequenciaRespiratoria" INTEGER,
    "peso" DOUBLE PRECISION,
    "notas" TEXT,
    "avpu" TEXT,
    "o2Suplementar" BOOLEAN,
    "news2" INTEGER,
    "news2Completo" BOOLEAN,
    "news2ParametrosFalta" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "news2ParametroIsolado3" BOOLEAN,
    "pews" INTEGER,
    "glasgow" INTEGER,
    "pamMedia" DOUBLE PRECISION,
    "vasopressores" BOOLEAN,
    "origem" TEXT DEFAULT 'manual',

    CONSTRAINT "sinais_vitais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivos_monitor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "localizacao" TEXT,
    "apiKeyHash" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "doenteId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaLeitura" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivos_monitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balancos_hidricos" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "registadoPorId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "balancos_hidricos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes_feridas" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "registadoPorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "tipo" TEXT NOT NULL,
    "localizacao" VARCHAR(300) NOT NULL,
    "estadoCicatrizacao" TEXT NOT NULL,
    "comprimento" DOUBLE PRECISION,
    "largura" DOUBLE PRECISION,
    "profundidade" DOUBLE PRECISION,
    "leito" TEXT,
    "exsudadoVolume" TEXT,
    "exsudadoTipo" TEXT,
    "periferia" TEXT,
    "dor" INTEGER,
    "odor" BOOLEAN NOT NULL DEFAULT false,
    "pensoAplicado" VARCHAR(200),
    "proximaTroca" TIMESTAMP(3),
    "notas" VARCHAR(2000),

    CONSTRAINT "avaliacoes_feridas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bolsas_sangue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "numeroUnidade" TEXT NOT NULL,
    "componente" TEXT NOT NULL,
    "grupoABO" TEXT NOT NULL,
    "rhD" TEXT NOT NULL,
    "volumeMl" INTEGER,
    "dataColheita" TIMESTAMP(3),
    "dataValidade" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'disponivel',
    "reservadaParaId" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bolsas_sangue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_transfusao" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "prescritoPorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "componente" TEXT NOT NULL,
    "numeroUnidades" INTEGER NOT NULL DEFAULT 1,
    "grupoABO" TEXT,
    "rhD" TEXT,
    "urgencia" TEXT NOT NULL DEFAULT 'rotina',
    "indicacao" VARCHAR(500) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "motivoCancelamento" VARCHAR(500),

    CONSTRAINT "pedidos_transfusao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registos_transfusao" (
    "id" TEXT NOT NULL,
    "pedidoTransfusaoId" TEXT NOT NULL,
    "bolsaId" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "administradoPorId" TEXT NOT NULL,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadoEm" TIMESTAMP(3),
    "verificacaoABO" BOOLEAN NOT NULL DEFAULT false,
    "verificacaoUnidade" BOOLEAN NOT NULL DEFAULT false,
    "verificacaoValidade" BOOLEAN NOT NULL DEFAULT false,
    "compativel" BOOLEAN NOT NULL,
    "segundoVerificadorId" TEXT,
    "consentimentoId" TEXT,
    "observacoes" VARCHAR(1000),

    CONSTRAINT "registos_transfusao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reacoes_transfusionais" (
    "id" TEXT NOT NULL,
    "registoTransfusaoId" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "registadoPorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "gravidade" TEXT NOT NULL,
    "sintomas" VARCHAR(1000) NOT NULL,
    "medidas" VARCHAR(1000),
    "notificadoHemovigilancia" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "reacoes_transfusionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lista_espera" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT,
    "nomeDoente" TEXT,
    "medicoId" TEXT,
    "especialidade" TEXT NOT NULL,
    "prioridade" TEXT NOT NULL DEFAULT 'normal',
    "estado" TEXT NOT NULL DEFAULT 'em_espera',
    "contactoTelefone" TEXT,
    "notas" VARCHAR(500),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lista_espera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receitas_eletronicas" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "prescritoPorId" TEXT NOT NULL,
    "numeroReceita" TEXT,
    "codigoDispensa" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'emitida',
    "ambiente" TEXT NOT NULL DEFAULT 'sandbox',
    "medicamentos" JSONB NOT NULL,
    "erro" TEXT,
    "dataEmissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receitas_eletronicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "utilizadorId" TEXT,
    "utilizadorNome" TEXT,
    "utilizadorRole" TEXT,
    "acao" TEXT NOT NULL,
    "entidadeId" TEXT,
    "entidadeTipo" TEXT,
    "detalhes" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "correlationId" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'app',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT,
    "prevHash" TEXT,
    "hash" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "desafios_mfa" (
    "jti" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "consumidoEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "desafios_mfa_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "totp_consumidos" (
    "chave" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "totp_consumidos_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "cron_locks" (
    "nome" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cron_locks_pkey" PRIMARY KEY ("nome")
);

-- CreateTable
CREATE TABLE "audit_checkpoints" (
    "id" TEXT NOT NULL,
    "seqInicio" INTEGER NOT NULL,
    "seqFim" INTEGER NOT NULL,
    "raiz" TEXT NOT NULL,
    "prevCheckpointHash" TEXT,
    "assinatura" TEXT,
    "totalEntradas" INTEGER NOT NULL,
    "ancoradoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acessos_leitura" (
    "id" TEXT NOT NULL,
    "utilizadorId" TEXT,
    "utilizadorNome" TEXT,
    "utilizadorRole" TEXT,
    "entidadeTipo" TEXT NOT NULL,
    "entidadeId" TEXT,
    "rota" TEXT,
    "ip" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acessos_leitura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "descricao" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercent" INTEGER NOT NULL DEFAULT 100,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "servicos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "atualizadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alergias" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "alergenio" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "severidade" TEXT NOT NULL,
    "notas" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "removidaPorId" TEXT,
    "motivoRemocao" TEXT,

    CONSTRAINT "alergias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactos_emergencia" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "relacao" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "contactos_emergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_clinicos" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "severidade" INTEGER NOT NULL DEFAULT 1,
    "lido" BOOLEAN NOT NULL DEFAULT false,
    "urgencia" BOOLEAN NOT NULL DEFAULT false,
    "acusadoPorId" TEXT,
    "acusadoEm" TIMESTAMP(3),
    "escaladoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_clinicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes_risco" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "pontuacao" INTEGER NOT NULL,
    "itens" JSONB NOT NULL,
    "risco" TEXT NOT NULL,
    "registadoPorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacoes_risco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sumarios_alta" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "motivoAlta" TEXT NOT NULL,
    "destino" TEXT,
    "resumoClinical" TEXT NOT NULL,
    "prescricaoSaida" TEXT,
    "medicoFamilia" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riscReadmissao" TEXT,
    "fatoresReadmissao" TEXT,
    "recomendacoesAlta" TEXT,
    "cartaAlta" TEXT,
    "cartaAltaEstado" TEXT,
    "cartaAltaRevistaPorId" TEXT,
    "cartaAltaRevistaEm" TIMESTAMP(3),
    "cartaAltaAssinadaPorId" TEXT,
    "cartaAltaAssinadaEm" TIMESTAMP(3),
    "icd10Code" TEXT,

    CONSTRAINT "sumarios_alta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivos_tokens" (
    "id" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivos_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes_inapp" (
    "id" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "dadosExtra" JSONB,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidaEm" TIMESTAMP(3),

    CONSTRAINT "notificacoes_inapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exames" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "solicitadoPorId" TEXT NOT NULL,
    "tipo" "TipoExame" NOT NULL,
    "descricao" TEXT NOT NULL,
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoExame" NOT NULL DEFAULT 'solicitado',
    "resultado" TEXT,
    "dataResultado" TIMESTAMP(3),
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laudos_radiologicos" (
    "id" TEXT NOT NULL,
    "exameId" TEXT NOT NULL,
    "radiologistaId" TEXT NOT NULL,
    "tecnica" TEXT,
    "achados" TEXT NOT NULL,
    "conclusao" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'rascunho',
    "assinadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "laudos_radiologicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ficheiros_exame" (
    "id" TEXT NOT NULL,
    "exameId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,

    CONSTRAINT "ficheiros_exame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodios_urgencia" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT,
    "nomeTemporario" TEXT,
    "queixaPrincipal" TEXT NOT NULL,
    "triagem" "CorTriagem" NOT NULL,
    "corAnterior" TEXT,
    "estadoEpisodio" "EstadoEpisodio" NOT NULL DEFAULT 'sala_espera',
    "triadoPorId" TEXT NOT NULL,
    "medicoResponsavelId" TEXT,
    "dataEntrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iniciadoAtendimentoEm" TIMESTAMP(3),
    "dataSaida" TIMESTAMP(3),
    "notas" TEXT,
    "sinaisVitaisTriagem" JSONB,
    "preNotificacao" BOOLEAN NOT NULL DEFAULT false,
    "etaMinutos" INTEGER,
    "condicaoPrevia" TEXT,
    "salaAtendimento" TEXT,
    "news2Triagem" INTEGER,
    "idadeAproximada" INTEGER,
    "sexo" TEXT,
    "consciente" BOOLEAN,
    "glasgow" INTEGER,
    "mecanismo" TEXT,
    "vitalsPASistolica" INTEGER,
    "vitalsPADiastolica" INTEGER,
    "vitalsFC" INTEGER,
    "vitalsSpO2" INTEGER,
    "vitalsFR" INTEGER,
    "intervencoes" TEXT[],
    "especialidadeActivada" TEXT,
    "especialidadeActivadaEm" TIMESTAMP(3),
    "especialidadeActivadaPorId" TEXT,

    CONSTRAINT "episodios_urgencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atualizacoes_transporte" (
    "id" TEXT NOT NULL,
    "episodioId" TEXT NOT NULL,
    "registadoPorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "texto" VARCHAR(1000) NOT NULL,
    "novaETA" INTEGER,

    CONSTRAINT "atualizacoes_transporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cirurgias_programadas" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "designacao" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "duracaoPrevista" INTEGER NOT NULL,
    "sala" TEXT NOT NULL,
    "estado" "EstadoCirurgia" NOT NULL DEFAULT 'agendada',
    "cirurgiaoId" TEXT NOT NULL,
    "anestesistaId" TEXT,
    "equipa" JSONB,
    "notasPreOperatorio" TEXT,
    "notasPosOperatorio" TEXT,
    "complicacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cirurgias_programadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklists_cirurgia" (
    "id" TEXT NOT NULL,
    "cirurgiaId" TEXT NOT NULL,
    "signInEm" TIMESTAMP(3),
    "signInPorId" TEXT,
    "signInDados" JSONB,
    "timeOutEm" TIMESTAMP(3),
    "timeOutPorId" TEXT,
    "timeOutDados" JSONB,
    "signOutEm" TIMESTAMP(3),
    "signOutPorId" TEXT,
    "signOutDados" JSONB,

    CONSTRAINT "checklists_cirurgia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultas" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT,
    "nomeDoente" TEXT,
    "medicoId" TEXT NOT NULL,
    "especialidade" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "duracao" INTEGER NOT NULL DEFAULT 30,
    "estado" "EstadoConsulta" NOT NULL DEFAULT 'agendada',
    "notas" TEXT,
    "diagnostico" TEXT,
    "proximaConsulta" TIMESTAMP(3),
    "codigo" TEXT,
    "checkinEm" TIMESTAMP(3),
    "tipo" TEXT NOT NULL DEFAULT 'presencial',
    "videoRoomId" TEXT,
    "videoIniciadaEm" TIMESTAMP(3),
    "videoTerminouEm" TIMESTAMP(3),
    "lembreteEnviadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_medico" (
    "id" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    "duracaoSlot" INTEGER NOT NULL DEFAULT 20,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_medico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkins_sala_espera" (
    "id" TEXT NOT NULL,
    "nomeDoente" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3),
    "numeroUtente" TEXT,
    "motivo" TEXT NOT NULL,
    "prioridade" INTEGER NOT NULL DEFAULT 3,
    "estado" "EstadoCheckin" NOT NULL DEFAULT 'aguardando',
    "chegadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chamadoEm" TIMESTAMP(3),
    "atendidoEm" TIMESTAMP(3),
    "rececionistadoPorId" TEXT,
    "medicoId" TEXT,
    "observacoes" TEXT,

    CONSTRAINT "checkins_sala_espera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoStock" NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantidadeMinima" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unidade" TEXT NOT NULL,
    "validade" TIMESTAMP(3),
    "servico" TEXT NOT NULL,
    "precoUnitario" DOUBLE PRECISION,
    "catalogoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_farmacia" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "servico" TEXT NOT NULL,
    "estado" "EstadoPedidoFarmacia" NOT NULL DEFAULT 'pendente',
    "solicitadoPorId" TEXT NOT NULL,
    "processadoPorId" TEXT,
    "aprovadoPorId" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "motivoRejeicao" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedidos_farmacia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogo_medicamentos" (
    "id" TEXT NOT NULL,
    "dci" TEXT NOT NULL,
    "nomeMarca" TEXT,
    "formaFarmaceutica" TEXT NOT NULL,
    "classeTerap" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "concentracao" TEXT,
    "codigoATC" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalogo_medicamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes_stock" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transferencias_stock" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "servicoOrigem" TEXT NOT NULL,
    "servicoDestino" TEXT NOT NULL,
    "motivo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "solicitadoPorId" TEXT NOT NULL,
    "confirmadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transferencias_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nif" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "morada" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encomendas_fornecedor" (
    "id" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "quantidadeEncomendada" DOUBLE PRECISION NOT NULL,
    "precoUnitario" DOUBLE PRECISION,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "dataEntregaPrevista" TIMESTAMP(3),
    "dataEntregaReal" TIMESTAMP(3),
    "observacoes" TEXT,
    "recebioPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encomendas_fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos_reabilitacao" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "fisioterapeutaId" TEXT NOT NULL,
    "objetivos" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFimPrevista" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planos_reabilitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_fisioterapia" (
    "id" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "fisioterapeutaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "duracao" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "evolucao" TEXT,
    "estado" "EstadoSessao" NOT NULL DEFAULT 'agendada',

    CONSTRAINT "sessoes_fisioterapia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_internos" (
    "id" TEXT NOT NULL,
    "tipo" "TipoPedidoInterno" NOT NULL,
    "doenteId" TEXT,
    "localOrigem" TEXT,
    "localDestino" TEXT,
    "descricao" TEXT NOT NULL,
    "prioridade" "PrioridadeTarefa" NOT NULL,
    "estado" "EstadoPedidoInterno" NOT NULL DEFAULT 'pendente',
    "solicitadoPorId" TEXT NOT NULL,
    "executadoPorId" TEXT,
    "servicoOrigem" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "pedidos_internos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anuncios" (
    "id" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "servico" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3),

    CONSTRAINT "anuncios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_internas" (
    "id" TEXT NOT NULL,
    "remetenteId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "assunto" TEXT,
    "texto" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_internas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexos_mensagem" (
    "id" TEXT NOT NULL,
    "mensagemId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexos_mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interconsultas" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "requisitanteId" TEXT NOT NULL,
    "especialidadeAlvo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoInterconsulta" NOT NULL DEFAULT 'pendente',
    "medicoRespostaId" TEXT,
    "resposta" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidaEm" TIMESTAMP(3),

    CONSTRAINT "interconsultas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivos_invasivos" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "tipo" "TipoDispositivoInvasivo" NOT NULL,
    "localizacao" TEXT,
    "dataInsercao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataRemocao" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "inseridoPorId" TEXT NOT NULL,

    CONSTRAINT "dispositivos_invasivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidentes_ti" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" "TipoIncidenteTI" NOT NULL,
    "subRoleAlvo" TEXT,
    "prioridade" "PrioridadeIncidenteTI" NOT NULL DEFAULT 'media',
    "estado" "EstadoIncidenteTI" NOT NULL DEFAULT 'aberto',
    "criadoPorId" TEXT NOT NULL,
    "responsavelId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidentes_ti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_incidentes_ti" (
    "id" TEXT NOT NULL,
    "incidenteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_incidentes_ti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_ti" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" "TipoPedidoTI" NOT NULL,
    "estado" "EstadoPedidoTI" NOT NULL DEFAULT 'pendente',
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidoEm" TIMESTAMP(3),
    "criadoPorId" TEXT NOT NULL,
    "responsavelId" TEXT,

    CONSTRAINT "pedidos_ti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fichas_pessoais_doente" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "nif" TEXT,
    "numeroSNS" TEXT,
    "morada" TEXT,
    "codigoPostal" TEXT,
    "localidade" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "entidadeSeguradora" TEXT,
    "numeroApolice" TEXT,
    "tipoCobertura" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPorId" TEXT,

    CONSTRAINT "fichas_pessoais_doente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodios_faturacao" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "consultaId" TEXT,
    "estado" "EstadoFatura" NOT NULL DEFAULT 'pendente',
    "dataEmissao" TIMESTAMP(3),
    "totalBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCobrado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tipoCobertura" TEXT,
    "notas" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "episodios_faturacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_fatura" (
    "id" TEXT NOT NULL,
    "episodioFaturacaoId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "precoUnitario" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itens_fatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "episodioFaturacaoId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "metodo" TEXT NOT NULL,
    "referencia" TEXT,
    "registadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atos_clinicos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "precoBase" DOUBLE PRECISION NOT NULL,
    "especialidade" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atos_clinicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atos_consulta" (
    "id" TEXT NOT NULL,
    "consultaId" TEXT NOT NULL,
    "atoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "precoUnitario" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atos_consulta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "letra" TEXT NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'aguarda',
    "prioridade" TEXT NOT NULL DEFAULT 'normal',
    "balcao" TEXT,
    "nomeUtente" TEXT,
    "telefone" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chamadoEm" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revogado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problemas_clinicos" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ativo',
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "registadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "problemas_clinicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipamentos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "numeroSerie" TEXT,
    "localizacao" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'operacional',
    "ultimaManutencao" TIMESTAMP(3),
    "proximaManutencao" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manutencoes" (
    "id" TEXT NOT NULL,
    "equipamentoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "prioridade" TEXT NOT NULL DEFAULT 'normal',
    "reportadoPorId" TEXT,
    "tecnicoId" TEXT,
    "dataReporte" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataConclusao" TIMESTAMP(3),
    "observacoes" TEXT,

    CONSTRAINT "manutencoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ausencias" (
    "id" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "observacoes" TEXT,
    "aprovadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ausencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trocas_folga" (
    "id" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "dataOrigem" TIMESTAMP(3) NOT NULL,
    "dataDestino" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "aprovadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trocas_folga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formacoes_utilizadores" (
    "id" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dataRealizacao" TIMESTAMP(3) NOT NULL,
    "dataExpiracao" TIMESTAMP(3),
    "entidade" TEXT,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formacoes_utilizadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_adversos" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "gravidade" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "servicoId" TEXT,
    "doenteId" TEXT,
    "registadoPorId" TEXT,
    "acaoCorretiva" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'aberto',
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventos_adversos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_especialidade" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "duracao" INTEGER NOT NULL,
    "descricao" TEXT,
    "evolucao" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'agendada',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_especialidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes_desempenho" (
    "id" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "avaliadorId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "dataAvaliacao" TIMESTAMP(3) NOT NULL,
    "pontuacaoGeral" INTEGER NOT NULL,
    "pontosFortes" TEXT,
    "areasMelhoria" TEXT,
    "observacoes" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'rascunho',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacoes_desempenho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dados_contratuais" (
    "id" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "tipoVinculo" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFimPrevista" TIMESTAMP(3),
    "diasFeriasAnuais" INTEGER NOT NULL DEFAULT 22,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dados_contratuais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimentos_informados" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "assinadoDoenteEm" TIMESTAMP(3),
    "assinadoTestemunhaEm" TIMESTAMP(3),
    "testemunhaId" TEXT,
    "recusado" BOOLEAN NOT NULL DEFAULT false,
    "motivoRecusa" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" TEXT NOT NULL,

    CONSTRAINT "consentimentos_informados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "break_glass_access" (
    "id" TEXT NOT NULL,
    "utilizadorId" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "ip" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiradoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "break_glass_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocolos_clinicos" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estadoGeral" TEXT NOT NULL DEFAULT 'ativo',
    "ativadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "protocolos_clinicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_protocolo" (
    "id" TEXT NOT NULL,
    "protocoloId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "prazo" INTEGER,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "concluidoEm" TIMESTAMP(3),
    "concluidoPorId" TEXT,

    CONSTRAINT "itens_protocolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescricoes_dieta" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "restricoes" TEXT[],
    "observacoes" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadaPorId" TEXT NOT NULL,

    CONSTRAINT "prescricoes_dieta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "culturas_microbiologicas" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "dataColheita" TIMESTAMP(3) NOT NULL,
    "tipoAmostra" TEXT NOT NULL,
    "agente" TEXT,
    "antibiograma" JSONB,
    "resultado" "ResultadoCultura" NOT NULL DEFAULT 'pendente',
    "servico" TEXT,
    "observacoes" TEXT,
    "registadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "culturas_microbiologicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surtos_iacs" (
    "id" TEXT NOT NULL,
    "agente" TEXT NOT NULL,
    "servico" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "estado" "EstadoSurto" NOT NULL DEFAULT 'activo',
    "numCasos" INTEGER NOT NULL DEFAULT 1,
    "medidas" JSONB,
    "observacoes" TEXT,
    "registadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "surtos_iacs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conformidade_checklist" (
    "id" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'verificar',
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPorId" TEXT,

    CONSTRAINT "conformidade_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sinalizacoes_preocupante" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "criadaPorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvida" BOOLEAN NOT NULL DEFAULT false,
    "resolvidaEm" TIMESTAMP(3),
    "resolvidaPorId" TEXT,
    "motivo" VARCHAR(500) NOT NULL,
    "nivelUrgencia" TEXT NOT NULL DEFAULT 'normal',

    CONSTRAINT "sinalizacoes_preocupante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_sepsis" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criterio" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "resolvidoEm" TIMESTAMP(3),
    "hemoculturasColhidas" BOOLEAN NOT NULL DEFAULT false,
    "hemoculturasEm" TIMESTAMP(3),
    "antibioticosIniciados" BOOLEAN NOT NULL DEFAULT false,
    "antibioticosEm" TIMESTAMP(3),
    "lactatoMedido" BOOLEAN NOT NULL DEFAULT false,
    "lactatoEm" TIMESTAMP(3),
    "fluidoterapiaIniciada" BOOLEAN NOT NULL DEFAULT false,
    "fluidoterapiaEm" TIMESTAMP(3),

    CONSTRAINT "alertas_sepsis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baselines_doente" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "calculadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nRegistos" INTEGER NOT NULL,
    "fcMedia" DOUBLE PRECISION,
    "fcSd" DOUBLE PRECISION,
    "pasSistolicaMedia" DOUBLE PRECISION,
    "pasSistolicaSd" DOUBLE PRECISION,
    "pasDiastolicaMedia" DOUBLE PRECISION,
    "pasDiastolicaSd" DOUBLE PRECISION,
    "tempMedia" DOUBLE PRECISION,
    "tempSd" DOUBLE PRECISION,
    "spo2Media" DOUBLE PRECISION,
    "spo2Sd" DOUBLE PRECISION,
    "frMedia" DOUBLE PRECISION,
    "frSd" DOUBLE PRECISION,

    CONSTRAINT "baselines_doente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos_alta" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataAlvoDia" TIMESTAMP(3),
    "afebrилApenas24h" BOOLEAN NOT NULL DEFAULT false,
    "mobilidadeAdequada" BOOLEAN NOT NULL DEFAULT false,
    "alimentacaoOral" BOOLEAN NOT NULL DEFAULT false,
    "doresControladas" BOOLEAN NOT NULL DEFAULT false,
    "familiaInformada" BOOLEAN NOT NULL DEFAULT false,
    "transporteAssegurado" BOOLEAN NOT NULL DEFAULT false,
    "medicacaoPreparada" BOOLEAN NOT NULL DEFAULT false,
    "consultaSegAlt" BOOLEAN NOT NULL DEFAULT false,
    "notas" VARCHAR(1000),

    CONSTRAINT "planos_alta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliacoes_medicacao" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "medicacaoCasa" TEXT NOT NULL,
    "discrepancias" TEXT NOT NULL,
    "aprovadaEm" TIMESTAMP(3),
    "aprovadaPorId" TEXT,

    CONSTRAINT "reconciliacoes_medicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorios_passagem_turno" (
    "id" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "turno" TEXT NOT NULL,
    "servico" TEXT NOT NULL,
    "criadaPorId" TEXT NOT NULL,
    "confirmadaEm" TIMESTAMP(3),
    "confirmadaPorId" TEXT,
    "rascunho" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,

    CONSTRAINT "relatorios_passagem_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acessos_familiares" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nomeContacto" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "accessTokenExpiry" TIMESTAMP(3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "acessos_familiares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivos_fhir" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "doenteId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoPing" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivos_fhir_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sistemas_externos_saude" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "endpoint" TEXT,
    "authTipo" TEXT NOT NULL DEFAULT 'api_key',
    "authConfig" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaSincronizacao" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sistemas_externos_saude_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identificadores_externos" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "sistema" TEXT NOT NULL,
    "valorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "identificadores_externos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_saude" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "dataDocumento" TIMESTAMP(3) NOT NULL,
    "origem" TEXT NOT NULL,
    "sistemaOrigemId" TEXT,
    "formato" TEXT NOT NULL,
    "storageKey" TEXT,
    "urlExterna" TEXT,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER,
    "fhirResourceId" TEXT,
    "modalidadeDicom" TEXT,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "registadoPorId" TEXT,
    "assinadoEm" TIMESTAMP(3),
    "assinadoPorId" TEXT,
    "hashSHA256" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_saude_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_decisoes" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "aceite" BOOLEAN,
    "overrideMotivo" TEXT,
    "doenteId" TEXT,
    "utilizadorId" TEXT NOT NULL,
    "inputPayload" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_decisoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_metricas" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_metricas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outcomes_clinicos" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT,
    "dataOcorrido" TIMESTAMP(3) NOT NULL,
    "relacionadoAiDecisaoId" TEXT,
    "registadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outcomes_clinicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados_analise" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "parametro" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "unidade" TEXT NOT NULL,
    "refMin" DOUBLE PRECISION,
    "refMax" DOUBLE PRECISION,
    "alterado" BOOLEAN NOT NULL DEFAULT false,
    "critico" BOOLEAN NOT NULL DEFAULT false,
    "painel" TEXT,
    "observacoes" TEXT,
    "registadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registadoPorId" TEXT,

    CONSTRAINT "resultados_analise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos_feridas" (
    "id" TEXT NOT NULL,
    "avaliacaoId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadaPorId" TEXT NOT NULL,
    "analiseIA" JSONB,

    CONSTRAINT "fotos_feridas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guidelines_clinicas" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "versao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embeddingJson" TEXT,

    CONSTRAINT "guidelines_clinicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort_definitions" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "filtros" JSONB NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohort_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates_pro" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "campos" JSONB NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registos_pro" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "respostas" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registos_pro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_doentes" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_doentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hl7_mensagens" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "remetente" TEXT,
    "conteudoRaw" TEXT NOT NULL,
    "processado" BOOLEAN NOT NULL DEFAULT false,
    "erroMsg" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hl7_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "widgets" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "followup_agendados" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dataAgendada" TIMESTAMP(3) NOT NULL,
    "especialidade" TEXT,
    "responsavelId" TEXT NOT NULL,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "followup_agendados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "eventos" TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webauthn_credentials" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "deviceType" TEXT NOT NULL DEFAULT 'singleDevice',
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "transports" TEXT[],
    "nome" TEXT NOT NULL DEFAULT 'Passkey',
    "utilizadorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUsoEm" TIMESTAMP(3),

    CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompt_insights" (
    "id" TEXT NOT NULL,
    "semana" DATE NOT NULL,
    "tipo" TEXT NOT NULL,
    "taxaRejeicao" DOUBLE PRECISION NOT NULL,
    "padroes" TEXT NOT NULL,
    "sugestao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prompt_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_staffing_previsoes" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "turno" TEXT NOT NULL,
    "servicoId" TEXT,
    "pessoalAtual" INTEGER,
    "pessoalRecomendado" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "confianca" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_staffing_previsoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wellbeing_surveys" (
    "id" TEXT NOT NULL,
    "utilizadorId" TEXT,
    "respostas" JSONB NOT NULL,
    "scoreGlobal" INTEGER NOT NULL,
    "semana" DATE NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wellbeing_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transferencias_externas" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "hospitalDestino" TEXT NOT NULL,
    "servicoDestino" TEXT NOT NULL,
    "motivoTransfer" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "solicitadoPorId" TEXT NOT NULL,
    "aceitoPorId" TEXT,
    "notas" TEXT,
    "documentos" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidaEm" TIMESTAMP(3),

    CONSTRAINT "transferencias_externas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras_clinicas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "condicao" JSONB NOT NULL,
    "acoes" JSONB NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "servicoId" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regras_clinicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_providers" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gravidezes" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "dataUltimaMenstruacao" TIMESTAMP(3),
    "dataPrevistaParto" TIMESTAMP(3),
    "gravida" INTEGER,
    "para" INTEGER,
    "grupoSanguineo" TEXT,
    "fatoresRisco" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ativa',
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gravidezes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registos_partograma" (
    "id" TEXT NOT NULL,
    "gravidezId" TEXT NOT NULL,
    "momento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dilatacaoCm" INTEGER,
    "fcFetal" INTEGER,
    "contracoes10min" INTEGER,
    "descidaApresentacao" INTEGER,
    "notas" TEXT,
    "registadoPorId" TEXT NOT NULL,

    CONSTRAINT "registos_partograma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partos" (
    "id" TEXT NOT NULL,
    "gravidezId" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "complicacoes" TEXT,
    "apgar1" INTEGER,
    "apgar5" INTEGER,
    "pesoRN" DOUBLE PRECISION,
    "sexoRN" TEXT,
    "registadoPorId" TEXT NOT NULL,

    CONSTRAINT "partos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos_quimioterapia" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "protocoloNome" TEXT NOT NULL,
    "ciclosPrevistos" INTEGER NOT NULL,
    "intervaloDias" INTEGER NOT NULL DEFAULT 21,
    "alturaCm" DOUBLE PRECISION,
    "pesoKg" DOUBLE PRECISION,
    "superficieCorporalM2" DOUBLE PRECISION,
    "farmacos" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ativo',
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planos_quimioterapia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ciclos_quimioterapia" (
    "id" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "dataPrevista" TIMESTAMP(3),
    "dataAdministracao" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'agendado',
    "toxicidadeGrau" INTEGER,
    "notas" TEXT,
    "registadoPorId" TEXT,

    CONSTRAINT "ciclos_quimioterapia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_dialise" (
    "id" TEXT NOT NULL,
    "doenteId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modalidade" TEXT NOT NULL,
    "duracaoMin" INTEGER,
    "pesoSecoKg" DOUBLE PRECISION,
    "pesoPreKg" DOUBLE PRECISION,
    "pesoPosKg" DOUBLE PRECISION,
    "ultrafiltracaoMl" INTEGER,
    "fluxoSangueMlMin" INTEGER,
    "acessoVascular" TEXT,
    "paSistolicaPre" INTEGER,
    "paSistolicaPos" INTEGER,
    "complicacoes" TEXT,
    "notas" TEXT,
    "registadoPorId" TEXT NOT NULL,

    CONSTRAINT "sessoes_dialise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_config_chave_key" ON "roles_config"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "subroles_config_chave_key" ON "subroles_config"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "utilizadores_numeroFuncionario_key" ON "utilizadores"("numeroFuncionario");

-- CreateIndex
CREATE INDEX "utilizadores_tenantId_role_ativo_idx" ON "utilizadores"("tenantId", "role", "ativo");

-- CreateIndex
CREATE INDEX "utilizadores_role_ativo_idx" ON "utilizadores"("role", "ativo");

-- CreateIndex
CREATE INDEX "utilizadores_servico_idx" ON "utilizadores"("servico");

-- CreateIndex
CREATE UNIQUE INDEX "camas_numero_key" ON "camas"("numero");

-- CreateIndex
CREATE INDEX "camas_quarto_estado_idx" ON "camas"("quarto", "estado");

-- CreateIndex
CREATE INDEX "camas_servico_estado_idx" ON "camas"("servico", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "doentes_numeroProcesso_key" ON "doentes"("numeroProcesso");

-- CreateIndex
CREATE UNIQUE INDEX "doentes_camaId_key" ON "doentes"("camaId");

-- CreateIndex
CREATE INDEX "doentes_tenantId_estado_idx" ON "doentes"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "doentes_ativo_idx" ON "doentes"("ativo");

-- CreateIndex
CREATE INDEX "doentes_estado_idx" ON "doentes"("estado");

-- CreateIndex
CREATE INDEX "doentes_dataAdmissao_idx" ON "doentes"("dataAdmissao");

-- CreateIndex
CREATE INDEX "doentes_deletedAt_idx" ON "doentes"("deletedAt");

-- CreateIndex
CREATE INDEX "turnos_chefeTurnoId_idx" ON "turnos"("chefeTurnoId");

-- CreateIndex
CREATE INDEX "turnos_dataInicio_idx" ON "turnos"("dataInicio");

-- CreateIndex
CREATE INDEX "turnos_dataInicio_dataFim_tipo_idx" ON "turnos"("dataInicio", "dataFim", "tipo");

-- CreateIndex
CREATE INDEX "atribuicoes_doente_turnoId_idx" ON "atribuicoes_doente"("turnoId");

-- CreateIndex
CREATE UNIQUE INDEX "atribuicoes_doente_doenteId_enfermeiroId_turnoId_key" ON "atribuicoes_doente"("doenteId", "enfermeiroId", "turnoId");

-- CreateIndex
CREATE INDEX "horarios_entrada_utilizadorId_idx" ON "horarios_entrada"("utilizadorId");

-- CreateIndex
CREATE UNIQUE INDEX "horarios_entrada_turnoId_utilizadorId_key" ON "horarios_entrada"("turnoId", "utilizadorId");

-- CreateIndex
CREATE INDEX "passagens_turno_estadoDesafio_idx" ON "passagens_turno"("estadoDesafio");

-- CreateIndex
CREATE INDEX "passagens_turno_doenteId_idx" ON "passagens_turno"("doenteId");

-- CreateIndex
CREATE UNIQUE INDEX "presenca_online_utilizadorId_key" ON "presenca_online"("utilizadorId");

-- CreateIndex
CREATE INDEX "registos_checkin_utilizadorId_criadoEm_idx" ON "registos_checkin"("utilizadorId", "criadoEm");

-- CreateIndex
CREATE INDEX "notas_clinicas_doenteId_criadaEm_idx" ON "notas_clinicas"("doenteId", "criadaEm");

-- CreateIndex
CREATE INDEX "notas_clinicas_deletedAt_idx" ON "notas_clinicas"("deletedAt");

-- CreateIndex
CREATE INDEX "notas_clinicas_doenteId_deletedAt_idx" ON "notas_clinicas"("doenteId", "deletedAt");

-- CreateIndex
CREATE INDEX "notas_clinicas_adendas_notaClinicaId_criadaEm_idx" ON "notas_clinicas_adendas"("notaClinicaId", "criadaEm");

-- CreateIndex
CREATE INDEX "escalas_clinicas_doenteId_tipo_idx" ON "escalas_clinicas"("doenteId", "tipo");

-- CreateIndex
CREATE INDEX "notas_turno_turnoId_idx" ON "notas_turno"("turnoId");

-- CreateIndex
CREATE INDEX "notas_turno_doenteId_idx" ON "notas_turno"("doenteId");

-- CreateIndex
CREATE INDEX "tarefas_doenteId_estado_idx" ON "tarefas"("doenteId", "estado");

-- CreateIndex
CREATE INDEX "tarefas_responsavelId_estado_idx" ON "tarefas"("responsavelId", "estado");

-- CreateIndex
CREATE INDEX "tarefas_turnoId_idx" ON "tarefas"("turnoId");

-- CreateIndex
CREATE INDEX "medicacoes_doenteId_overrideAlergia_idx" ON "medicacoes"("doenteId", "overrideAlergia");

-- CreateIndex
CREATE INDEX "medicacoes_doenteId_ativo_idx" ON "medicacoes"("doenteId", "ativo");

-- CreateIndex
CREATE INDEX "medicacoes_doenteId_ativo_iniciadoEm_idx" ON "medicacoes"("doenteId", "ativo", "iniciadoEm");

-- CreateIndex
CREATE INDEX "medicacoes_estadoValidacao_idx" ON "medicacoes"("estadoValidacao");

-- CreateIndex
CREATE INDEX "medicacoes_deletedAt_idx" ON "medicacoes"("deletedAt");

-- CreateIndex
CREATE INDEX "medicacoes_doenteId_deletedAt_idx" ON "medicacoes"("doenteId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "stewardship_antibiotico_medicacaoId_key" ON "stewardship_antibiotico"("medicacaoId");

-- CreateIndex
CREATE INDEX "stewardship_antibiotico_doenteId_alertaEmitido_idx" ON "stewardship_antibiotico"("doenteId", "alertaEmitido");

-- CreateIndex
CREATE INDEX "registos_medicacao_medicacaoId_idx" ON "registos_medicacao"("medicacaoId");

-- CreateIndex
CREATE INDEX "registos_medicacao_doenteId_administradoEm_idx" ON "registos_medicacao"("doenteId", "administradoEm");

-- CreateIndex
CREATE INDEX "registos_medicacao_deletedAt_idx" ON "registos_medicacao"("deletedAt");

-- CreateIndex
CREATE INDEX "registos_medicacao_doenteId_deletedAt_idx" ON "registos_medicacao"("doenteId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "escalas_mes_ano_key" ON "escalas"("mes", "ano");

-- CreateIndex
CREATE INDEX "horarios_turno_profissionais_utilizadorId_idx" ON "horarios_turno_profissionais"("utilizadorId");

-- CreateIndex
CREATE INDEX "pedidos_troca_turno_turnoId_idx" ON "pedidos_troca_turno"("turnoId");

-- CreateIndex
CREATE INDEX "atribuicoes_horario_turno_utilizadorId_horarioTurnoId_idx" ON "atribuicoes_horario_turno"("utilizadorId", "horarioTurnoId");

-- CreateIndex
CREATE INDEX "atribuicoes_horario_turno_doenteId_idx" ON "atribuicoes_horario_turno"("doenteId");

-- CreateIndex
CREATE UNIQUE INDEX "atribuicoes_horario_turno_horarioTurnoId_doenteId_utilizado_key" ON "atribuicoes_horario_turno"("horarioTurnoId", "doenteId", "utilizadorId");

-- CreateIndex
CREATE INDEX "sinais_vitais_doenteId_data_idx" ON "sinais_vitais"("doenteId", "data");

-- CreateIndex
CREATE INDEX "dispositivos_monitor_ativo_idx" ON "dispositivos_monitor"("ativo");

-- CreateIndex
CREATE INDEX "balancos_hidricos_doenteId_data_idx" ON "balancos_hidricos"("doenteId", "data");

-- CreateIndex
CREATE INDEX "avaliacoes_feridas_doenteId_criadaEm_idx" ON "avaliacoes_feridas"("doenteId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "bolsas_sangue_numeroUnidade_key" ON "bolsas_sangue"("numeroUnidade");

-- CreateIndex
CREATE INDEX "bolsas_sangue_tenantId_estado_idx" ON "bolsas_sangue"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "bolsas_sangue_componente_grupoABO_rhD_estado_idx" ON "bolsas_sangue"("componente", "grupoABO", "rhD", "estado");

-- CreateIndex
CREATE INDEX "bolsas_sangue_dataValidade_idx" ON "bolsas_sangue"("dataValidade");

-- CreateIndex
CREATE INDEX "pedidos_transfusao_doenteId_criadaEm_idx" ON "pedidos_transfusao"("doenteId", "criadaEm");

-- CreateIndex
CREATE INDEX "pedidos_transfusao_estado_idx" ON "pedidos_transfusao"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "registos_transfusao_bolsaId_key" ON "registos_transfusao"("bolsaId");

-- CreateIndex
CREATE INDEX "registos_transfusao_doenteId_iniciadoEm_idx" ON "registos_transfusao"("doenteId", "iniciadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "reacoes_transfusionais_registoTransfusaoId_key" ON "reacoes_transfusionais"("registoTransfusaoId");

-- CreateIndex
CREATE INDEX "reacoes_transfusionais_doenteId_criadaEm_idx" ON "reacoes_transfusionais"("doenteId", "criadaEm");

-- CreateIndex
CREATE INDEX "lista_espera_especialidade_estado_prioridade_idx" ON "lista_espera"("especialidade", "estado", "prioridade");

-- CreateIndex
CREATE UNIQUE INDEX "receitas_eletronicas_numeroReceita_key" ON "receitas_eletronicas"("numeroReceita");

-- CreateIndex
CREATE INDEX "receitas_eletronicas_doenteId_criadaEm_idx" ON "receitas_eletronicas"("doenteId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_seq_key" ON "audit_logs"("seq");

-- CreateIndex
CREATE INDEX "audit_logs_utilizadorId_createdAt_idx" ON "audit_logs"("utilizadorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entidadeTipo_entidadeId_idx" ON "audit_logs"("entidadeTipo", "entidadeId");

-- CreateIndex
CREATE INDEX "audit_logs_correlationId_idx" ON "audit_logs"("correlationId");

-- CreateIndex
CREATE INDEX "desafios_mfa_utilizadorId_criadoEm_idx" ON "desafios_mfa"("utilizadorId", "criadoEm");

-- CreateIndex
CREATE INDEX "desafios_mfa_expiraEm_idx" ON "desafios_mfa"("expiraEm");

-- CreateIndex
CREATE INDEX "totp_consumidos_expiraEm_idx" ON "totp_consumidos"("expiraEm");

-- CreateIndex
CREATE INDEX "audit_checkpoints_seqFim_idx" ON "audit_checkpoints"("seqFim");

-- CreateIndex
CREATE INDEX "acessos_leitura_utilizadorId_createdAt_idx" ON "acessos_leitura"("utilizadorId", "createdAt");

-- CreateIndex
CREATE INDEX "acessos_leitura_entidadeTipo_entidadeId_idx" ON "acessos_leitura"("entidadeTipo", "entidadeId");

-- CreateIndex
CREATE INDEX "acessos_leitura_createdAt_idx" ON "acessos_leitura"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "alergias_doenteId_idx" ON "alergias"("doenteId");

-- CreateIndex
CREATE INDEX "contactos_emergencia_doenteId_idx" ON "contactos_emergencia"("doenteId");

-- CreateIndex
CREATE INDEX "alertas_clinicos_doenteId_lido_idx" ON "alertas_clinicos"("doenteId", "lido");

-- CreateIndex
CREATE INDEX "alertas_clinicos_doenteId_lido_criadoEm_idx" ON "alertas_clinicos"("doenteId", "lido", "criadoEm");

-- CreateIndex
CREATE INDEX "alertas_clinicos_criadoEm_idx" ON "alertas_clinicos"("criadoEm");

-- CreateIndex
CREATE INDEX "avaliacoes_risco_doenteId_idx" ON "avaliacoes_risco"("doenteId");

-- CreateIndex
CREATE UNIQUE INDEX "sumarios_alta_doenteId_key" ON "sumarios_alta"("doenteId");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_tokens_token_key" ON "dispositivos_tokens"("token");

-- CreateIndex
CREATE INDEX "dispositivos_tokens_utilizadorId_idx" ON "dispositivos_tokens"("utilizadorId");

-- CreateIndex
CREATE INDEX "notificacoes_inapp_utilizadorId_lida_idx" ON "notificacoes_inapp"("utilizadorId", "lida");

-- CreateIndex
CREATE INDEX "notificacoes_inapp_utilizadorId_lida_criadaEm_idx" ON "notificacoes_inapp"("utilizadorId", "lida", "criadaEm");

-- CreateIndex
CREATE INDEX "notificacoes_inapp_criadaEm_idx" ON "notificacoes_inapp"("criadaEm");

-- CreateIndex
CREATE INDEX "exames_estado_urgente_idx" ON "exames"("estado", "urgente");

-- CreateIndex
CREATE INDEX "exames_doenteId_estado_idx" ON "exames"("doenteId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "laudos_radiologicos_exameId_key" ON "laudos_radiologicos"("exameId");

-- CreateIndex
CREATE INDEX "episodios_urgencia_estadoEpisodio_dataEntrada_idx" ON "episodios_urgencia"("estadoEpisodio", "dataEntrada");

-- CreateIndex
CREATE INDEX "episodios_urgencia_doenteId_idx" ON "episodios_urgencia"("doenteId");

-- CreateIndex
CREATE INDEX "atualizacoes_transporte_episodioId_criadaEm_idx" ON "atualizacoes_transporte"("episodioId", "criadaEm");

-- CreateIndex
CREATE INDEX "cirurgias_programadas_dataHora_idx" ON "cirurgias_programadas"("dataHora");

-- CreateIndex
CREATE INDEX "cirurgias_programadas_estado_idx" ON "cirurgias_programadas"("estado");

-- CreateIndex
CREATE INDEX "cirurgias_programadas_doenteId_idx" ON "cirurgias_programadas"("doenteId");

-- CreateIndex
CREATE UNIQUE INDEX "checklists_cirurgia_cirurgiaId_key" ON "checklists_cirurgia"("cirurgiaId");

-- CreateIndex
CREATE UNIQUE INDEX "consultas_codigo_key" ON "consultas"("codigo");

-- CreateIndex
CREATE INDEX "consultas_medicoId_dataHora_idx" ON "consultas"("medicoId", "dataHora");

-- CreateIndex
CREATE INDEX "consultas_codigo_idx" ON "consultas"("codigo");

-- CreateIndex
CREATE INDEX "consultas_doenteId_idx" ON "consultas"("doenteId");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_medico_medicoId_diaSemana_key" ON "agenda_medico"("medicoId", "diaSemana");

-- CreateIndex
CREATE INDEX "checkins_sala_espera_estado_chegadaEm_idx" ON "checkins_sala_espera"("estado", "chegadaEm");

-- CreateIndex
CREATE INDEX "stock_items_catalogoId_idx" ON "stock_items"("catalogoId");

-- CreateIndex
CREATE INDEX "stock_items_servico_idx" ON "stock_items"("servico");

-- CreateIndex
CREATE INDEX "pedidos_farmacia_estado_criadoEm_idx" ON "pedidos_farmacia"("estado", "criadoEm");

-- CreateIndex
CREATE INDEX "ajustes_stock_stockItemId_idx" ON "ajustes_stock"("stockItemId");

-- CreateIndex
CREATE INDEX "ajustes_stock_criadoEm_idx" ON "ajustes_stock"("criadoEm");

-- CreateIndex
CREATE INDEX "ajustes_stock_utilizadorId_idx" ON "ajustes_stock"("utilizadorId");

-- CreateIndex
CREATE INDEX "transferencias_stock_stockItemId_idx" ON "transferencias_stock"("stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_nif_key" ON "fornecedores"("nif");

-- CreateIndex
CREATE INDEX "encomendas_fornecedor_fornecedorId_idx" ON "encomendas_fornecedor"("fornecedorId");

-- CreateIndex
CREATE INDEX "encomendas_fornecedor_stockItemId_idx" ON "encomendas_fornecedor"("stockItemId");

-- CreateIndex
CREATE INDEX "planos_reabilitacao_doenteId_idx" ON "planos_reabilitacao"("doenteId");

-- CreateIndex
CREATE INDEX "sessoes_fisioterapia_doenteId_idx" ON "sessoes_fisioterapia"("doenteId");

-- CreateIndex
CREATE INDEX "pedidos_internos_estado_criadoEm_idx" ON "pedidos_internos"("estado", "criadoEm");

-- CreateIndex
CREATE INDEX "pedidos_internos_doenteId_idx" ON "pedidos_internos"("doenteId");

-- CreateIndex
CREATE INDEX "mensagens_internas_destinatarioId_lida_idx" ON "mensagens_internas"("destinatarioId", "lida");

-- CreateIndex
CREATE INDEX "mensagens_internas_remetenteId_idx" ON "mensagens_internas"("remetenteId");

-- CreateIndex
CREATE INDEX "anexos_mensagem_mensagemId_idx" ON "anexos_mensagem"("mensagemId");

-- CreateIndex
CREATE INDEX "interconsultas_doenteId_idx" ON "interconsultas"("doenteId");

-- CreateIndex
CREATE INDEX "interconsultas_especialidadeAlvo_estado_idx" ON "interconsultas"("especialidadeAlvo", "estado");

-- CreateIndex
CREATE INDEX "interconsultas_requisitanteId_estado_idx" ON "interconsultas"("requisitanteId", "estado");

-- CreateIndex
CREATE INDEX "dispositivos_invasivos_doenteId_ativo_idx" ON "dispositivos_invasivos"("doenteId", "ativo");

-- CreateIndex
CREATE INDEX "incidentes_ti_estado_idx" ON "incidentes_ti"("estado");

-- CreateIndex
CREATE INDEX "incidentes_ti_subRoleAlvo_idx" ON "incidentes_ti"("subRoleAlvo");

-- CreateIndex
CREATE INDEX "notas_incidentes_ti_incidenteId_idx" ON "notas_incidentes_ti"("incidenteId");

-- CreateIndex
CREATE INDEX "pedidos_ti_estado_idx" ON "pedidos_ti"("estado");

-- CreateIndex
CREATE INDEX "pedidos_ti_criadoPorId_idx" ON "pedidos_ti"("criadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "fichas_pessoais_doente_doenteId_key" ON "fichas_pessoais_doente"("doenteId");

-- CreateIndex
CREATE UNIQUE INDEX "episodios_faturacao_consultaId_key" ON "episodios_faturacao"("consultaId");

-- CreateIndex
CREATE INDEX "episodios_faturacao_doenteId_idx" ON "episodios_faturacao"("doenteId");

-- CreateIndex
CREATE INDEX "episodios_faturacao_estado_idx" ON "episodios_faturacao"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "atos_clinicos_codigo_key" ON "atos_clinicos"("codigo");

-- CreateIndex
CREATE INDEX "tickets_estado_criadoEm_idx" ON "tickets"("estado", "criadoEm");

-- CreateIndex
CREATE INDEX "tickets_tipo_criadoEm_idx" ON "tickets"("tipo", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_utilizadorId_idx" ON "refresh_tokens"("utilizadorId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "problemas_clinicos_doenteId_idx" ON "problemas_clinicos"("doenteId");

-- CreateIndex
CREATE INDEX "equipamentos_estado_idx" ON "equipamentos"("estado");

-- CreateIndex
CREATE INDEX "manutencoes_equipamentoId_idx" ON "manutencoes"("equipamentoId");

-- CreateIndex
CREATE INDEX "manutencoes_estado_idx" ON "manutencoes"("estado");

-- CreateIndex
CREATE INDEX "ausencias_utilizadorId_idx" ON "ausencias"("utilizadorId");

-- CreateIndex
CREATE INDEX "ausencias_estado_idx" ON "ausencias"("estado");

-- CreateIndex
CREATE INDEX "trocas_folga_solicitanteId_idx" ON "trocas_folga"("solicitanteId");

-- CreateIndex
CREATE INDEX "trocas_folga_destinatarioId_idx" ON "trocas_folga"("destinatarioId");

-- CreateIndex
CREATE INDEX "trocas_folga_estado_idx" ON "trocas_folga"("estado");

-- CreateIndex
CREATE INDEX "formacoes_utilizadores_utilizadorId_idx" ON "formacoes_utilizadores"("utilizadorId");

-- CreateIndex
CREATE INDEX "eventos_adversos_tipo_idx" ON "eventos_adversos"("tipo");

-- CreateIndex
CREATE INDEX "eventos_adversos_gravidade_idx" ON "eventos_adversos"("gravidade");

-- CreateIndex
CREATE INDEX "eventos_adversos_estado_idx" ON "eventos_adversos"("estado");

-- CreateIndex
CREATE INDEX "eventos_adversos_ocorridoEm_idx" ON "eventos_adversos"("ocorridoEm");

-- CreateIndex
CREATE INDEX "eventos_adversos_doenteId_idx" ON "eventos_adversos"("doenteId");

-- CreateIndex
CREATE INDEX "sessoes_especialidade_profissionalId_data_idx" ON "sessoes_especialidade"("profissionalId", "data");

-- CreateIndex
CREATE INDEX "sessoes_especialidade_doenteId_idx" ON "sessoes_especialidade"("doenteId");

-- CreateIndex
CREATE INDEX "avaliacoes_desempenho_utilizadorId_idx" ON "avaliacoes_desempenho"("utilizadorId");

-- CreateIndex
CREATE INDEX "avaliacoes_desempenho_avaliadorId_idx" ON "avaliacoes_desempenho"("avaliadorId");

-- CreateIndex
CREATE UNIQUE INDEX "dados_contratuais_utilizadorId_key" ON "dados_contratuais"("utilizadorId");

-- CreateIndex
CREATE INDEX "consentimentos_informados_doenteId_idx" ON "consentimentos_informados"("doenteId");

-- CreateIndex
CREATE INDEX "consentimentos_informados_tipo_idx" ON "consentimentos_informados"("tipo");

-- CreateIndex
CREATE INDEX "consentimentos_informados_doenteId_tipo_idx" ON "consentimentos_informados"("doenteId", "tipo");

-- CreateIndex
CREATE INDEX "break_glass_access_utilizadorId_doenteId_ativo_idx" ON "break_glass_access"("utilizadorId", "doenteId", "ativo");

-- CreateIndex
CREATE INDEX "break_glass_access_expiradoEm_idx" ON "break_glass_access"("expiradoEm");

-- CreateIndex
CREATE INDEX "break_glass_access_doenteId_idx" ON "break_glass_access"("doenteId");

-- CreateIndex
CREATE INDEX "protocolos_clinicos_doenteId_estadoGeral_idx" ON "protocolos_clinicos"("doenteId", "estadoGeral");

-- CreateIndex
CREATE INDEX "protocolos_clinicos_tipo_estadoGeral_idx" ON "protocolos_clinicos"("tipo", "estadoGeral");

-- CreateIndex
CREATE INDEX "itens_protocolo_protocoloId_idx" ON "itens_protocolo"("protocoloId");

-- CreateIndex
CREATE INDEX "prescricoes_dieta_doenteId_ativa_idx" ON "prescricoes_dieta"("doenteId", "ativa");

-- CreateIndex
CREATE INDEX "culturas_microbiologicas_doenteId_idx" ON "culturas_microbiologicas"("doenteId");

-- CreateIndex
CREATE INDEX "culturas_microbiologicas_resultado_idx" ON "culturas_microbiologicas"("resultado");

-- CreateIndex
CREATE INDEX "culturas_microbiologicas_agente_idx" ON "culturas_microbiologicas"("agente");

-- CreateIndex
CREATE INDEX "surtos_iacs_estado_idx" ON "surtos_iacs"("estado");

-- CreateIndex
CREATE INDEX "surtos_iacs_agente_idx" ON "surtos_iacs"("agente");

-- CreateIndex
CREATE UNIQUE INDEX "conformidade_checklist_itemKey_key" ON "conformidade_checklist"("itemKey");

-- CreateIndex
CREATE INDEX "sinalizacoes_preocupante_doenteId_resolvida_idx" ON "sinalizacoes_preocupante"("doenteId", "resolvida");

-- CreateIndex
CREATE INDEX "alertas_sepsis_doenteId_resolvido_idx" ON "alertas_sepsis"("doenteId", "resolvido");

-- CreateIndex
CREATE UNIQUE INDEX "baselines_doente_doenteId_key" ON "baselines_doente"("doenteId");

-- CreateIndex
CREATE UNIQUE INDEX "planos_alta_doenteId_key" ON "planos_alta"("doenteId");

-- CreateIndex
CREATE INDEX "reconciliacoes_medicacao_doenteId_idx" ON "reconciliacoes_medicacao"("doenteId");

-- CreateIndex
CREATE INDEX "relatorios_passagem_turno_servico_criadaEm_idx" ON "relatorios_passagem_turno"("servico", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "acessos_familiares_accessTokenHash_key" ON "acessos_familiares"("accessTokenHash");

-- CreateIndex
CREATE INDEX "acessos_familiares_doenteId_ativo_idx" ON "acessos_familiares"("doenteId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_fhir_apiKeyHash_key" ON "dispositivos_fhir"("apiKeyHash");

-- CreateIndex
CREATE INDEX "dispositivos_fhir_ativo_idx" ON "dispositivos_fhir"("ativo");

-- CreateIndex
CREATE INDEX "sistemas_externos_saude_ativo_tipo_idx" ON "sistemas_externos_saude"("ativo", "tipo");

-- CreateIndex
CREATE INDEX "identificadores_externos_doenteId_idx" ON "identificadores_externos"("doenteId");

-- CreateIndex
CREATE UNIQUE INDEX "identificadores_externos_doenteId_sistema_tipo_key" ON "identificadores_externos"("doenteId", "sistema", "tipo");

-- CreateIndex
CREATE INDEX "documentos_saude_doenteId_tipo_idx" ON "documentos_saude"("doenteId", "tipo");

-- CreateIndex
CREATE INDEX "documentos_saude_doenteId_dataDocumento_idx" ON "documentos_saude"("doenteId", "dataDocumento");

-- CreateIndex
CREATE INDEX "documentos_saude_fhirResourceId_idx" ON "documentos_saude"("fhirResourceId");

-- CreateIndex
CREATE INDEX "ai_decisoes_doenteId_criadoEm_idx" ON "ai_decisoes"("doenteId", "criadoEm");

-- CreateIndex
CREATE INDEX "ai_decisoes_tipo_criadoEm_idx" ON "ai_decisoes"("tipo", "criadoEm");

-- CreateIndex
CREATE INDEX "ai_decisoes_utilizadorId_idx" ON "ai_decisoes"("utilizadorId");

-- CreateIndex
CREATE INDEX "ai_metricas_feature_criadoEm_idx" ON "ai_metricas"("feature", "criadoEm");

-- CreateIndex
CREATE INDEX "outcomes_clinicos_doenteId_tipo_idx" ON "outcomes_clinicos"("doenteId", "tipo");

-- CreateIndex
CREATE INDEX "outcomes_clinicos_tipo_criadoEm_idx" ON "outcomes_clinicos"("tipo", "criadoEm");

-- CreateIndex
CREATE INDEX "resultados_analise_doenteId_registadoEm_idx" ON "resultados_analise"("doenteId", "registadoEm");

-- CreateIndex
CREATE INDEX "resultados_analise_critico_idx" ON "resultados_analise"("critico");

-- CreateIndex
CREATE INDEX "fotos_feridas_avaliacaoId_idx" ON "fotos_feridas"("avaliacaoId");

-- CreateIndex
CREATE INDEX "guidelines_clinicas_categoria_idx" ON "guidelines_clinicas"("categoria");

-- CreateIndex
CREATE INDEX "cohort_definitions_criadoPorId_idx" ON "cohort_definitions"("criadoPorId");

-- CreateIndex
CREATE INDEX "registos_pro_doenteId_criadoEm_idx" ON "registos_pro"("doenteId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "portal_doentes_doenteId_key" ON "portal_doentes"("doenteId");

-- CreateIndex
CREATE UNIQUE INDEX "portal_doentes_email_key" ON "portal_doentes"("email");

-- CreateIndex
CREATE INDEX "hl7_mensagens_tipo_processado_idx" ON "hl7_mensagens"("tipo", "processado");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_configs_userId_key" ON "dashboard_configs"("userId");

-- CreateIndex
CREATE INDEX "followup_agendados_responsavelId_concluido_idx" ON "followup_agendados"("responsavelId", "concluido");

-- CreateIndex
CREATE INDEX "followup_agendados_doenteId_idx" ON "followup_agendados"("doenteId");

-- CreateIndex
CREATE INDEX "webhooks_criadoPorId_idx" ON "webhooks"("criadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "webauthn_credentials_credentialId_key" ON "webauthn_credentials"("credentialId");

-- CreateIndex
CREATE INDEX "webauthn_credentials_utilizadorId_idx" ON "webauthn_credentials"("utilizadorId");

-- CreateIndex
CREATE INDEX "ai_prompt_insights_semana_idx" ON "ai_prompt_insights"("semana");

-- CreateIndex
CREATE INDEX "ai_staffing_previsoes_data_idx" ON "ai_staffing_previsoes"("data");

-- CreateIndex
CREATE INDEX "wellbeing_surveys_semana_idx" ON "wellbeing_surveys"("semana");

-- CreateIndex
CREATE INDEX "transferencias_externas_doenteId_idx" ON "transferencias_externas"("doenteId");

-- CreateIndex
CREATE INDEX "transferencias_externas_estado_idx" ON "transferencias_externas"("estado");

-- CreateIndex
CREATE INDEX "regras_clinicas_ativa_idx" ON "regras_clinicas"("ativa");

-- CreateIndex
CREATE INDEX "gravidezes_doenteId_estado_idx" ON "gravidezes"("doenteId", "estado");

-- CreateIndex
CREATE INDEX "registos_partograma_gravidezId_momento_idx" ON "registos_partograma"("gravidezId", "momento");

-- CreateIndex
CREATE UNIQUE INDEX "partos_gravidezId_key" ON "partos"("gravidezId");

-- CreateIndex
CREATE INDEX "planos_quimioterapia_doenteId_estado_idx" ON "planos_quimioterapia"("doenteId", "estado");

-- CreateIndex
CREATE INDEX "ciclos_quimioterapia_planoId_numero_idx" ON "ciclos_quimioterapia"("planoId", "numero");

-- CreateIndex
CREATE INDEX "sessoes_dialise_doenteId_data_idx" ON "sessoes_dialise"("doenteId", "data");

-- AddForeignKey
ALTER TABLE "subroles_config" ADD CONSTRAINT "subroles_config_roleChave_fkey" FOREIGN KEY ("roleChave") REFERENCES "roles_config"("chave") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilizadores" ADD CONSTRAINT "utilizadores_chefeId_fkey" FOREIGN KEY ("chefeId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doentes" ADD CONSTRAINT "doentes_camaId_fkey" FOREIGN KEY ("camaId") REFERENCES "camas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doentes" ADD CONSTRAINT "doentes_administrativoAdmissaoId_fkey" FOREIGN KEY ("administrativoAdmissaoId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_chefeTurnoId_fkey" FOREIGN KEY ("chefeTurnoId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_doente" ADD CONSTRAINT "atribuicoes_doente_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_doente" ADD CONSTRAINT "atribuicoes_doente_enfermeiroId_fkey" FOREIGN KEY ("enfermeiroId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_doente" ADD CONSTRAINT "atribuicoes_doente_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_entrada" ADD CONSTRAINT "horarios_entrada_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_entrada" ADD CONSTRAINT "horarios_entrada_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passagens_turno" ADD CONSTRAINT "passagens_turno_turnoAnteriorId_fkey" FOREIGN KEY ("turnoAnteriorId") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passagens_turno" ADD CONSTRAINT "passagens_turno_turnoAtualId_fkey" FOREIGN KEY ("turnoAtualId") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passagens_turno" ADD CONSTRAINT "passagens_turno_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presenca_online" ADD CONSTRAINT "presenca_online_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_checkin" ADD CONSTRAINT "registos_checkin_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_clinicas" ADD CONSTRAINT "notas_clinicas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_clinicas" ADD CONSTRAINT "notas_clinicas_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_clinicas" ADD CONSTRAINT "notas_clinicas_assinadaPorId_fkey" FOREIGN KEY ("assinadaPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_clinicas_adendas" ADD CONSTRAINT "notas_clinicas_adendas_notaClinicaId_fkey" FOREIGN KEY ("notaClinicaId") REFERENCES "notas_clinicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_clinicas_adendas" ADD CONSTRAINT "notas_clinicas_adendas_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas_clinicas" ADD CONSTRAINT "escalas_clinicas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas_clinicas" ADD CONSTRAINT "escalas_clinicas_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_turno" ADD CONSTRAINT "notas_turno_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_turno" ADD CONSTRAINT "notas_turno_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_turno" ADD CONSTRAINT "notas_turno_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicacoes" ADD CONSTRAINT "medicacoes_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicacoes" ADD CONSTRAINT "medicacoes_prescritoPorId_fkey" FOREIGN KEY ("prescritoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicacoes" ADD CONSTRAINT "medicacoes_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicacoes" ADD CONSTRAINT "medicacoes_assinadoPorId_fkey" FOREIGN KEY ("assinadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicacoes" ADD CONSTRAINT "medicacoes_overrideAlergenioId_fkey" FOREIGN KEY ("overrideAlergenioId") REFERENCES "alergias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stewardship_antibiotico" ADD CONSTRAINT "stewardship_antibiotico_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stewardship_antibiotico" ADD CONSTRAINT "stewardship_antibiotico_medicacaoId_fkey" FOREIGN KEY ("medicacaoId") REFERENCES "medicacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_medicacao" ADD CONSTRAINT "registos_medicacao_medicacaoId_fkey" FOREIGN KEY ("medicacaoId") REFERENCES "medicacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_medicacao" ADD CONSTRAINT "registos_medicacao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_medicacao" ADD CONSTRAINT "registos_medicacao_administradoPorId_fkey" FOREIGN KEY ("administradoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_turno" ADD CONSTRAINT "horarios_turno_escalId_fkey" FOREIGN KEY ("escalId") REFERENCES "escalas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_turno_profissionais" ADD CONSTRAINT "horarios_turno_profissionais_horarioTurnoId_fkey" FOREIGN KEY ("horarioTurnoId") REFERENCES "horarios_turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_turno_profissionais" ADD CONSTRAINT "horarios_turno_profissionais_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_troca_turno" ADD CONSTRAINT "pedidos_troca_turno_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_troca_turno" ADD CONSTRAINT "pedidos_troca_turno_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_troca_turno" ADD CONSTRAINT "pedidos_troca_turno_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "horarios_turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_troca_turno" ADD CONSTRAINT "pedidos_troca_turno_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_horario_turno" ADD CONSTRAINT "atribuicoes_horario_turno_horarioTurnoId_fkey" FOREIGN KEY ("horarioTurnoId") REFERENCES "horarios_turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_horario_turno" ADD CONSTRAINT "atribuicoes_horario_turno_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_horario_turno" ADD CONSTRAINT "atribuicoes_horario_turno_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_horario_turno" ADD CONSTRAINT "atribuicoes_horario_turno_atribuidoPorId_fkey" FOREIGN KEY ("atribuidoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinais_vitais" ADD CONSTRAINT "sinais_vitais_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinais_vitais" ADD CONSTRAINT "sinais_vitais_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balancos_hidricos" ADD CONSTRAINT "balancos_hidricos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balancos_hidricos" ADD CONSTRAINT "balancos_hidricos_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_feridas" ADD CONSTRAINT "avaliacoes_feridas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_feridas" ADD CONSTRAINT "avaliacoes_feridas_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolsas_sangue" ADD CONSTRAINT "bolsas_sangue_reservadaParaId_fkey" FOREIGN KEY ("reservadaParaId") REFERENCES "pedidos_transfusao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_transfusao" ADD CONSTRAINT "pedidos_transfusao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_transfusao" ADD CONSTRAINT "pedidos_transfusao_prescritoPorId_fkey" FOREIGN KEY ("prescritoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_transfusao" ADD CONSTRAINT "registos_transfusao_pedidoTransfusaoId_fkey" FOREIGN KEY ("pedidoTransfusaoId") REFERENCES "pedidos_transfusao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_transfusao" ADD CONSTRAINT "registos_transfusao_bolsaId_fkey" FOREIGN KEY ("bolsaId") REFERENCES "bolsas_sangue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_transfusao" ADD CONSTRAINT "registos_transfusao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_transfusao" ADD CONSTRAINT "registos_transfusao_administradoPorId_fkey" FOREIGN KEY ("administradoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_transfusao" ADD CONSTRAINT "registos_transfusao_segundoVerificadorId_fkey" FOREIGN KEY ("segundoVerificadorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_transfusao" ADD CONSTRAINT "registos_transfusao_consentimentoId_fkey" FOREIGN KEY ("consentimentoId") REFERENCES "consentimentos_informados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reacoes_transfusionais" ADD CONSTRAINT "reacoes_transfusionais_registoTransfusaoId_fkey" FOREIGN KEY ("registoTransfusaoId") REFERENCES "registos_transfusao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reacoes_transfusionais" ADD CONSTRAINT "reacoes_transfusionais_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reacoes_transfusionais" ADD CONSTRAINT "reacoes_transfusionais_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alergias" ADD CONSTRAINT "alergias_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos_emergencia" ADD CONSTRAINT "contactos_emergencia_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_clinicos" ADD CONSTRAINT "alertas_clinicos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_clinicos" ADD CONSTRAINT "alertas_clinicos_acusadoPorId_fkey" FOREIGN KEY ("acusadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_risco" ADD CONSTRAINT "avaliacoes_risco_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_risco" ADD CONSTRAINT "avaliacoes_risco_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sumarios_alta" ADD CONSTRAINT "sumarios_alta_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sumarios_alta" ADD CONSTRAINT "sumarios_alta_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_tokens" ADD CONSTRAINT "dispositivos_tokens_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes_inapp" ADD CONSTRAINT "notificacoes_inapp_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exames" ADD CONSTRAINT "exames_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exames" ADD CONSTRAINT "exames_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laudos_radiologicos" ADD CONSTRAINT "laudos_radiologicos_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES "exames"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficheiros_exame" ADD CONSTRAINT "ficheiros_exame_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES "exames"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_urgencia" ADD CONSTRAINT "episodios_urgencia_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_urgencia" ADD CONSTRAINT "episodios_urgencia_triadoPorId_fkey" FOREIGN KEY ("triadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_urgencia" ADD CONSTRAINT "episodios_urgencia_medicoResponsavelId_fkey" FOREIGN KEY ("medicoResponsavelId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_urgencia" ADD CONSTRAINT "episodios_urgencia_especialidadeActivadaPorId_fkey" FOREIGN KEY ("especialidadeActivadaPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atualizacoes_transporte" ADD CONSTRAINT "atualizacoes_transporte_episodioId_fkey" FOREIGN KEY ("episodioId") REFERENCES "episodios_urgencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atualizacoes_transporte" ADD CONSTRAINT "atualizacoes_transporte_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cirurgias_programadas" ADD CONSTRAINT "cirurgias_programadas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cirurgias_programadas" ADD CONSTRAINT "cirurgias_programadas_cirurgiaoId_fkey" FOREIGN KEY ("cirurgiaoId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cirurgias_programadas" ADD CONSTRAINT "cirurgias_programadas_anestesistaId_fkey" FOREIGN KEY ("anestesistaId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists_cirurgia" ADD CONSTRAINT "checklists_cirurgia_cirurgiaId_fkey" FOREIGN KEY ("cirurgiaId") REFERENCES "cirurgias_programadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists_cirurgia" ADD CONSTRAINT "checklists_cirurgia_signInPorId_fkey" FOREIGN KEY ("signInPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists_cirurgia" ADD CONSTRAINT "checklists_cirurgia_timeOutPorId_fkey" FOREIGN KEY ("timeOutPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists_cirurgia" ADD CONSTRAINT "checklists_cirurgia_signOutPorId_fkey" FOREIGN KEY ("signOutPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_medico" ADD CONSTRAINT "agenda_medico_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins_sala_espera" ADD CONSTRAINT "checkins_sala_espera_rececionistadoPorId_fkey" FOREIGN KEY ("rececionistadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins_sala_espera" ADD CONSTRAINT "checkins_sala_espera_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_catalogoId_fkey" FOREIGN KEY ("catalogoId") REFERENCES "catalogo_medicamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_farmacia" ADD CONSTRAINT "pedidos_farmacia_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_farmacia" ADD CONSTRAINT "pedidos_farmacia_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_farmacia" ADD CONSTRAINT "pedidos_farmacia_processadoPorId_fkey" FOREIGN KEY ("processadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_farmacia" ADD CONSTRAINT "pedidos_farmacia_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_stock" ADD CONSTRAINT "ajustes_stock_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_stock" ADD CONSTRAINT "ajustes_stock_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_stock" ADD CONSTRAINT "transferencias_stock_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_stock" ADD CONSTRAINT "transferencias_stock_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_stock" ADD CONSTRAINT "transferencias_stock_confirmadoPorId_fkey" FOREIGN KEY ("confirmadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encomendas_fornecedor" ADD CONSTRAINT "encomendas_fornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encomendas_fornecedor" ADD CONSTRAINT "encomendas_fornecedor_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encomendas_fornecedor" ADD CONSTRAINT "encomendas_fornecedor_recebioPorId_fkey" FOREIGN KEY ("recebioPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_reabilitacao" ADD CONSTRAINT "planos_reabilitacao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_reabilitacao" ADD CONSTRAINT "planos_reabilitacao_fisioterapeutaId_fkey" FOREIGN KEY ("fisioterapeutaId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_fisioterapia" ADD CONSTRAINT "sessoes_fisioterapia_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "planos_reabilitacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_fisioterapia" ADD CONSTRAINT "sessoes_fisioterapia_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_fisioterapia" ADD CONSTRAINT "sessoes_fisioterapia_fisioterapeutaId_fkey" FOREIGN KEY ("fisioterapeutaId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_internos" ADD CONSTRAINT "pedidos_internos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_internos" ADD CONSTRAINT "pedidos_internos_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_internos" ADD CONSTRAINT "pedidos_internos_executadoPorId_fkey" FOREIGN KEY ("executadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anuncios" ADD CONSTRAINT "anuncios_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_internas" ADD CONSTRAINT "mensagens_internas_remetenteId_fkey" FOREIGN KEY ("remetenteId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_internas" ADD CONSTRAINT "mensagens_internas_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos_mensagem" ADD CONSTRAINT "anexos_mensagem_mensagemId_fkey" FOREIGN KEY ("mensagemId") REFERENCES "mensagens_internas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_requisitanteId_fkey" FOREIGN KEY ("requisitanteId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_medicoRespostaId_fkey" FOREIGN KEY ("medicoRespostaId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_invasivos" ADD CONSTRAINT "dispositivos_invasivos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_invasivos" ADD CONSTRAINT "dispositivos_invasivos_inseridoPorId_fkey" FOREIGN KEY ("inseridoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes_ti" ADD CONSTRAINT "incidentes_ti_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes_ti" ADD CONSTRAINT "incidentes_ti_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_incidentes_ti" ADD CONSTRAINT "notas_incidentes_ti_incidenteId_fkey" FOREIGN KEY ("incidenteId") REFERENCES "incidentes_ti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_incidentes_ti" ADD CONSTRAINT "notas_incidentes_ti_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_ti" ADD CONSTRAINT "pedidos_ti_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_ti" ADD CONSTRAINT "pedidos_ti_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_pessoais_doente" ADD CONSTRAINT "fichas_pessoais_doente_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_pessoais_doente" ADD CONSTRAINT "fichas_pessoais_doente_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_faturacao" ADD CONSTRAINT "episodios_faturacao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_faturacao" ADD CONSTRAINT "episodios_faturacao_consultaId_fkey" FOREIGN KEY ("consultaId") REFERENCES "consultas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_faturacao" ADD CONSTRAINT "episodios_faturacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_fatura" ADD CONSTRAINT "itens_fatura_episodioFaturacaoId_fkey" FOREIGN KEY ("episodioFaturacaoId") REFERENCES "episodios_faturacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_episodioFaturacaoId_fkey" FOREIGN KEY ("episodioFaturacaoId") REFERENCES "episodios_faturacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atos_consulta" ADD CONSTRAINT "atos_consulta_consultaId_fkey" FOREIGN KEY ("consultaId") REFERENCES "consultas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atos_consulta" ADD CONSTRAINT "atos_consulta_atoId_fkey" FOREIGN KEY ("atoId") REFERENCES "atos_clinicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problemas_clinicos" ADD CONSTRAINT "problemas_clinicos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problemas_clinicos" ADD CONSTRAINT "problemas_clinicos_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manutencoes" ADD CONSTRAINT "manutencoes_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "equipamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manutencoes" ADD CONSTRAINT "manutencoes_reportadoPorId_fkey" FOREIGN KEY ("reportadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manutencoes" ADD CONSTRAINT "manutencoes_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trocas_folga" ADD CONSTRAINT "trocas_folga_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trocas_folga" ADD CONSTRAINT "trocas_folga_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trocas_folga" ADD CONSTRAINT "trocas_folga_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formacoes_utilizadores" ADD CONSTRAINT "formacoes_utilizadores_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_adversos" ADD CONSTRAINT "eventos_adversos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_adversos" ADD CONSTRAINT "eventos_adversos_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_especialidade" ADD CONSTRAINT "sessoes_especialidade_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_especialidade" ADD CONSTRAINT "sessoes_especialidade_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_desempenho" ADD CONSTRAINT "avaliacoes_desempenho_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_desempenho" ADD CONSTRAINT "avaliacoes_desempenho_avaliadorId_fkey" FOREIGN KEY ("avaliadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dados_contratuais" ADD CONSTRAINT "dados_contratuais_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimentos_informados" ADD CONSTRAINT "consentimentos_informados_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimentos_informados" ADD CONSTRAINT "consentimentos_informados_testemunhaId_fkey" FOREIGN KEY ("testemunhaId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimentos_informados" ADD CONSTRAINT "consentimentos_informados_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "break_glass_access" ADD CONSTRAINT "break_glass_access_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "break_glass_access" ADD CONSTRAINT "break_glass_access_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocolos_clinicos" ADD CONSTRAINT "protocolos_clinicos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocolos_clinicos" ADD CONSTRAINT "protocolos_clinicos_ativadoPorId_fkey" FOREIGN KEY ("ativadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_protocolo" ADD CONSTRAINT "itens_protocolo_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "protocolos_clinicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_protocolo" ADD CONSTRAINT "itens_protocolo_concluidoPorId_fkey" FOREIGN KEY ("concluidoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescricoes_dieta" ADD CONSTRAINT "prescricoes_dieta_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescricoes_dieta" ADD CONSTRAINT "prescricoes_dieta_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "culturas_microbiologicas" ADD CONSTRAINT "culturas_microbiologicas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "culturas_microbiologicas" ADD CONSTRAINT "culturas_microbiologicas_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surtos_iacs" ADD CONSTRAINT "surtos_iacs_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conformidade_checklist" ADD CONSTRAINT "conformidade_checklist_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinalizacoes_preocupante" ADD CONSTRAINT "sinalizacoes_preocupante_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinalizacoes_preocupante" ADD CONSTRAINT "sinalizacoes_preocupante_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinalizacoes_preocupante" ADD CONSTRAINT "sinalizacoes_preocupante_resolvidaPorId_fkey" FOREIGN KEY ("resolvidaPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_sepsis" ADD CONSTRAINT "alertas_sepsis_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baselines_doente" ADD CONSTRAINT "baselines_doente_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_alta" ADD CONSTRAINT "planos_alta_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliacoes_medicacao" ADD CONSTRAINT "reconciliacoes_medicacao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliacoes_medicacao" ADD CONSTRAINT "reconciliacoes_medicacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliacoes_medicacao" ADD CONSTRAINT "reconciliacoes_medicacao_aprovadaPorId_fkey" FOREIGN KEY ("aprovadaPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios_passagem_turno" ADD CONSTRAINT "relatorios_passagem_turno_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios_passagem_turno" ADD CONSTRAINT "relatorios_passagem_turno_confirmadaPorId_fkey" FOREIGN KEY ("confirmadaPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acessos_familiares" ADD CONSTRAINT "acessos_familiares_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acessos_familiares" ADD CONSTRAINT "acessos_familiares_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identificadores_externos" ADD CONSTRAINT "identificadores_externos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_saude" ADD CONSTRAINT "documentos_saude_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_saude" ADD CONSTRAINT "documentos_saude_sistemaOrigemId_fkey" FOREIGN KEY ("sistemaOrigemId") REFERENCES "sistemas_externos_saude"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_saude" ADD CONSTRAINT "documentos_saude_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_saude" ADD CONSTRAINT "documentos_saude_assinadoPorId_fkey" FOREIGN KEY ("assinadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decisoes" ADD CONSTRAINT "ai_decisoes_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcomes_clinicos" ADD CONSTRAINT "outcomes_clinicos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcomes_clinicos" ADD CONSTRAINT "outcomes_clinicos_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_analise" ADD CONSTRAINT "resultados_analise_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_analise" ADD CONSTRAINT "resultados_analise_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_feridas" ADD CONSTRAINT "fotos_feridas_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "avaliacoes_feridas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_feridas" ADD CONSTRAINT "fotos_feridas_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_definitions" ADD CONSTRAINT "cohort_definitions_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_pro" ADD CONSTRAINT "registos_pro_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_pro" ADD CONSTRAINT "registos_pro_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates_pro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_doentes" ADD CONSTRAINT "portal_doentes_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_doentes" ADD CONSTRAINT "portal_doentes_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_configs" ADD CONSTRAINT "dashboard_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup_agendados" ADD CONSTRAINT "followup_agendados_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup_agendados" ADD CONSTRAINT "followup_agendados_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_externas" ADD CONSTRAINT "transferencias_externas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_externas" ADD CONSTRAINT "transferencias_externas_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_externas" ADD CONSTRAINT "transferencias_externas_aceitoPorId_fkey" FOREIGN KEY ("aceitoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_clinicas" ADD CONSTRAINT "regras_clinicas_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gravidezes" ADD CONSTRAINT "gravidezes_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_partograma" ADD CONSTRAINT "registos_partograma_gravidezId_fkey" FOREIGN KEY ("gravidezId") REFERENCES "gravidezes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partos" ADD CONSTRAINT "partos_gravidezId_fkey" FOREIGN KEY ("gravidezId") REFERENCES "gravidezes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_quimioterapia" ADD CONSTRAINT "planos_quimioterapia_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ciclos_quimioterapia" ADD CONSTRAINT "ciclos_quimioterapia_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "planos_quimioterapia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_dialise" ADD CONSTRAINT "sessoes_dialise_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

