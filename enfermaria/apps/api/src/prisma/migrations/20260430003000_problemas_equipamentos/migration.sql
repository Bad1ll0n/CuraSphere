-- Problemas Clínicos
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

ALTER TABLE "problemas_clinicos"
  ADD CONSTRAINT "problemas_clinicos_doenteId_fkey"
  FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "problemas_clinicos"
  ADD CONSTRAINT "problemas_clinicos_registadoPorId_fkey"
  FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "problemas_clinicos_doenteId_idx" ON "problemas_clinicos"("doenteId");

-- Equipamentos
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

CREATE INDEX "equipamentos_estado_idx" ON "equipamentos"("estado");

-- Manutenções
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

ALTER TABLE "manutencoes"
  ADD CONSTRAINT "manutencoes_equipamentoId_fkey"
  FOREIGN KEY ("equipamentoId") REFERENCES "equipamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "manutencoes"
  ADD CONSTRAINT "manutencoes_reportadoPorId_fkey"
  FOREIGN KEY ("reportadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "manutencoes"
  ADD CONSTRAINT "manutencoes_tecnicoId_fkey"
  FOREIGN KEY ("tecnicoId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "manutencoes_equipamentoId_idx" ON "manutencoes"("equipamentoId");
CREATE INDEX "manutencoes_estado_idx" ON "manutencoes"("estado");
