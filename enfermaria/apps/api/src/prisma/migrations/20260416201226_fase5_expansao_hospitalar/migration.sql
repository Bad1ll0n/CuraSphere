-- CreateEnum
CREATE TYPE "Servico" AS ENUM ('internamento', 'urgencia', 'bloco_operatorio', 'consultas_externas', 'farmacia', 'fisioterapia', 'transporte', 'administrativo');

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
CREATE TYPE "TipoStock" AS ENUM ('medicamento', 'material', 'consumivel');

-- CreateEnum
CREATE TYPE "EstadoPedidoFarmacia" AS ENUM ('pendente', 'aprovado', 'dispensado', 'cancelado');

-- CreateEnum
CREATE TYPE "EstadoSessao" AS ENUM ('agendada', 'realizada', 'cancelada', 'faltou');

-- CreateEnum
CREATE TYPE "TipoPedidoInterno" AS ENUM ('transporte', 'esterilizacao', 'equipamento', 'limpeza');

-- CreateEnum
CREATE TYPE "EstadoPedidoInterno" AS ENUM ('pendente', 'em_curso', 'concluido', 'cancelado');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'triador';
ALTER TYPE "Role" ADD VALUE 'cirurgiao';
ALTER TYPE "Role" ADD VALUE 'anestesista';
ALTER TYPE "Role" ADD VALUE 'instrumentista';
ALTER TYPE "Role" ADD VALUE 'farmaceutico';
ALTER TYPE "Role" ADD VALUE 'tecnico_farmacia';
ALTER TYPE "Role" ADD VALUE 'fisioterapeuta';
ALTER TYPE "Role" ADD VALUE 'secretaria';

-- AlterTable
ALTER TABLE "utilizadores" ADD COLUMN     "servico" "Servico" NOT NULL DEFAULT 'internamento';

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
    "estadoEpisodio" "EstadoEpisodio" NOT NULL DEFAULT 'sala_espera',
    "triadoPorId" TEXT NOT NULL,
    "medicoResponsavelId" TEXT,
    "dataEntrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataSaida" TIMESTAMP(3),
    "notas" TEXT,
    "sinaisVitaisTriagem" JSONB,

    CONSTRAINT "episodios_urgencia_pkey" PRIMARY KEY ("id")
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
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultas_pkey" PRIMARY KEY ("id")
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
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedidos_farmacia_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "exames" ADD CONSTRAINT "exames_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exames" ADD CONSTRAINT "exames_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficheiros_exame" ADD CONSTRAINT "ficheiros_exame_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES "exames"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_urgencia" ADD CONSTRAINT "episodios_urgencia_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_urgencia" ADD CONSTRAINT "episodios_urgencia_triadoPorId_fkey" FOREIGN KEY ("triadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_urgencia" ADD CONSTRAINT "episodios_urgencia_medicoResponsavelId_fkey" FOREIGN KEY ("medicoResponsavelId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cirurgias_programadas" ADD CONSTRAINT "cirurgias_programadas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cirurgias_programadas" ADD CONSTRAINT "cirurgias_programadas_cirurgiaoId_fkey" FOREIGN KEY ("cirurgiaoId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cirurgias_programadas" ADD CONSTRAINT "cirurgias_programadas_anestesistaId_fkey" FOREIGN KEY ("anestesistaId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_farmacia" ADD CONSTRAINT "pedidos_farmacia_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_farmacia" ADD CONSTRAINT "pedidos_farmacia_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_farmacia" ADD CONSTRAINT "pedidos_farmacia_processadoPorId_fkey" FOREIGN KEY ("processadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_reabilitacao" ADD CONSTRAINT "planos_reabilitacao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_reabilitacao" ADD CONSTRAINT "planos_reabilitacao_fisioterapeutaId_fkey" FOREIGN KEY ("fisioterapeutaId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_fisioterapia" ADD CONSTRAINT "sessoes_fisioterapia_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "planos_reabilitacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_fisioterapia" ADD CONSTRAINT "sessoes_fisioterapia_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_fisioterapia" ADD CONSTRAINT "sessoes_fisioterapia_fisioterapeutaId_fkey" FOREIGN KEY ("fisioterapeutaId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_internos" ADD CONSTRAINT "pedidos_internos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_internos" ADD CONSTRAINT "pedidos_internos_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_internos" ADD CONSTRAINT "pedidos_internos_executadoPorId_fkey" FOREIGN KEY ("executadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anuncios" ADD CONSTRAINT "anuncios_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_internas" ADD CONSTRAINT "mensagens_internas_remetenteId_fkey" FOREIGN KEY ("remetenteId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_internas" ADD CONSTRAINT "mensagens_internas_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
