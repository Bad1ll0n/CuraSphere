-- CreateEnum
CREATE TYPE "EstadoPedidoTroca" AS ENUM ('pendente_destinatario', 'pendente_chefe', 'aprovado', 'rejeitado');

-- CreateTable
CREATE TABLE "pedidos_troca_turno" (
    "id" TEXT NOT NULL,
    "estado" "EstadoPedidoTroca" NOT NULL DEFAULT 'pendente_destinatario',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoEm" TIMESTAMP(3),
    "solicitanteId" TEXT NOT NULL,
    "turnoSolicitanteId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "turnoDestinatarioId" TEXT NOT NULL,
    "aprovadoPorId" TEXT,

    CONSTRAINT "pedidos_troca_turno_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pedidos_troca_turno" ADD CONSTRAINT "pedidos_troca_turno_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_troca_turno" ADD CONSTRAINT "pedidos_troca_turno_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_troca_turno" ADD CONSTRAINT "pedidos_troca_turno_turnoSolicitanteId_fkey" FOREIGN KEY ("turnoSolicitanteId") REFERENCES "horarios_turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_troca_turno" ADD CONSTRAINT "pedidos_troca_turno_turnoDestinatarioId_fkey" FOREIGN KEY ("turnoDestinatarioId") REFERENCES "horarios_turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_troca_turno" ADD CONSTRAINT "pedidos_troca_turno_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
