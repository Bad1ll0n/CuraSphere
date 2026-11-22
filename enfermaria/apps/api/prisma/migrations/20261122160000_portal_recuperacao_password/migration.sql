-- UX-28: recuperação de password do portal do doente (só o hash do token; 30 min; uso único).
CREATE TABLE "recuperacoes_portal" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recuperacoes_portal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recuperacoes_portal_tokenHash_key" ON "recuperacoes_portal"("tokenHash");
CREATE INDEX "recuperacoes_portal_portalId_idx" ON "recuperacoes_portal"("portalId");

ALTER TABLE "recuperacoes_portal" ADD CONSTRAINT "recuperacoes_portal_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "portal_doentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
