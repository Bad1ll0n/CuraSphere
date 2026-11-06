-- CreateIndex
CREATE INDEX "alertas_clinicos_lido_urgencia_criadoEm_idx" ON "alertas_clinicos"("lido", "urgencia", "criadoEm");

-- CreateIndex
CREATE INDEX "doentes_tenantId_ativo_estadoRegisto_dataAdmissao_idx" ON "doentes"("tenantId", "ativo", "estadoRegisto", "dataAdmissao");

-- CreateIndex
CREATE INDEX "registos_medicacao_medicacaoId_administradoEm_idx" ON "registos_medicacao"("medicacaoId", "administradoEm" DESC);
