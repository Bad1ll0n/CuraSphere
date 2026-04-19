-- CreateEnum
CREATE TYPE "TipoPedidoTI" AS ENUM ('listagem_dados', 'relatorio', 'acesso_sistema', 'backup', 'auditoria_dados', 'outro');

-- CreateEnum
CREATE TYPE "EstadoPedidoTI" AS ENUM ('pendente', 'em_curso', 'concluido', 'recusado');

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

-- CreateIndex
CREATE INDEX "pedidos_ti_estado_idx" ON "pedidos_ti"("estado");

-- CreateIndex
CREATE INDEX "pedidos_ti_criadoPorId_idx" ON "pedidos_ti"("criadoPorId");

-- AddForeignKey
ALTER TABLE "pedidos_ti" ADD CONSTRAINT "pedidos_ti_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_ti" ADD CONSTRAINT "pedidos_ti_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
