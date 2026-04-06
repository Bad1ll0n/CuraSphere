-- CreateEnum
CREATE TYPE "Role" AS ENUM ('enfermeiro', 'auxiliar', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'administrativo');

-- CreateEnum
CREATE TYPE "EstadoCama" AS ENUM ('livre', 'ocupada', 'em_limpeza', 'reservada');

-- CreateEnum
CREATE TYPE "EstadoDoente" AS ENUM ('estavel', 'grave', 'critico', 'alta_prevista');

-- CreateEnum
CREATE TYPE "TipoTurno" AS ENUM ('manha', 'tarde', 'noite');

-- CreateEnum
CREATE TYPE "TipoTarefa" AS ENUM ('clinica', 'logistica');

-- CreateEnum
CREATE TYPE "PrioridadeTarefa" AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- CreateEnum
CREATE TYPE "EstadoTarefa" AS ENUM ('pendente', 'em_progresso', 'concluida', 'cancelada');

-- CreateTable
CREATE TABLE "utilizadores" (
    "id" TEXT NOT NULL,
    "numeroFuncionario" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "ordemExperiencia" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utilizadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camas" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "quarto" TEXT NOT NULL,
    "estado" "EstadoCama" NOT NULL DEFAULT 'livre',

    CONSTRAINT "camas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doentes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3) NOT NULL,
    "numeroProcesso" TEXT NOT NULL,
    "estado" "EstadoDoente" NOT NULL DEFAULT 'estavel',
    "diagnosticoPrincipal" TEXT NOT NULL,
    "dataAdmissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataAltaPrevista" TIMESTAMP(3),
    "dataAlta" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "camaId" TEXT NOT NULL,
    "administrativoAdmissaoId" TEXT NOT NULL,

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

    CONSTRAINT "passagens_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_turno" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "turnoId" TEXT NOT NULL,
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
    "responsavelId" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,

    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicacoes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "frequencia" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadoEm" TIMESTAMP(3),
    "doenteId" TEXT NOT NULL,
    "prescritoPorId" TEXT NOT NULL,

    CONSTRAINT "medicacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registos_medicacao" (
    "id" TEXT NOT NULL,
    "administradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,
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

-- CreateIndex
CREATE UNIQUE INDEX "utilizadores_numeroFuncionario_key" ON "utilizadores"("numeroFuncionario");

-- CreateIndex
CREATE UNIQUE INDEX "camas_numero_key" ON "camas"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "doentes_numeroProcesso_key" ON "doentes"("numeroProcesso");

-- CreateIndex
CREATE UNIQUE INDEX "doentes_camaId_key" ON "doentes"("camaId");

-- CreateIndex
CREATE UNIQUE INDEX "atribuicoes_doente_doenteId_enfermeiroId_turnoId_key" ON "atribuicoes_doente"("doenteId", "enfermeiroId", "turnoId");

-- CreateIndex
CREATE UNIQUE INDEX "horarios_entrada_turnoId_utilizadorId_key" ON "horarios_entrada"("turnoId", "utilizadorId");

-- CreateIndex
CREATE UNIQUE INDEX "escalas_mes_ano_key" ON "escalas"("mes", "ano");

-- AddForeignKey
ALTER TABLE "doentes" ADD CONSTRAINT "doentes_camaId_fkey" FOREIGN KEY ("camaId") REFERENCES "camas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doentes" ADD CONSTRAINT "doentes_administrativoAdmissaoId_fkey" FOREIGN KEY ("administrativoAdmissaoId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_chefeTurnoId_fkey" FOREIGN KEY ("chefeTurnoId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_doente" ADD CONSTRAINT "atribuicoes_doente_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_doente" ADD CONSTRAINT "atribuicoes_doente_enfermeiroId_fkey" FOREIGN KEY ("enfermeiroId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_doente" ADD CONSTRAINT "atribuicoes_doente_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_entrada" ADD CONSTRAINT "horarios_entrada_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_entrada" ADD CONSTRAINT "horarios_entrada_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passagens_turno" ADD CONSTRAINT "passagens_turno_turnoAnteriorId_fkey" FOREIGN KEY ("turnoAnteriorId") REFERENCES "turnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passagens_turno" ADD CONSTRAINT "passagens_turno_turnoAtualId_fkey" FOREIGN KEY ("turnoAtualId") REFERENCES "turnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passagens_turno" ADD CONSTRAINT "passagens_turno_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_turno" ADD CONSTRAINT "notas_turno_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_turno" ADD CONSTRAINT "notas_turno_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_turno" ADD CONSTRAINT "notas_turno_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicacoes" ADD CONSTRAINT "medicacoes_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicacoes" ADD CONSTRAINT "medicacoes_prescritoPorId_fkey" FOREIGN KEY ("prescritoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_medicacao" ADD CONSTRAINT "registos_medicacao_medicacaoId_fkey" FOREIGN KEY ("medicacaoId") REFERENCES "medicacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_medicacao" ADD CONSTRAINT "registos_medicacao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_medicacao" ADD CONSTRAINT "registos_medicacao_administradoPorId_fkey" FOREIGN KEY ("administradoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_turno" ADD CONSTRAINT "horarios_turno_escalId_fkey" FOREIGN KEY ("escalId") REFERENCES "escalas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_turno_profissionais" ADD CONSTRAINT "horarios_turno_profissionais_horarioTurnoId_fkey" FOREIGN KEY ("horarioTurnoId") REFERENCES "horarios_turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_turno_profissionais" ADD CONSTRAINT "horarios_turno_profissionais_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
