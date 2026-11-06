-- DropForeignKey
ALTER TABLE "atribuicoes_doente" DROP CONSTRAINT "atribuicoes_doente_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "atribuicoes_doente" DROP CONSTRAINT "atribuicoes_doente_enfermeiroId_fkey";

-- DropForeignKey
ALTER TABLE "horarios_entrada" DROP CONSTRAINT "horarios_entrada_utilizadorId_fkey";

-- DropForeignKey
ALTER TABLE "passagens_turno" DROP CONSTRAINT "passagens_turno_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "registos_checkin" DROP CONSTRAINT "registos_checkin_utilizadorId_fkey";

-- DropForeignKey
ALTER TABLE "notas_clinicas" DROP CONSTRAINT "notas_clinicas_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "notas_clinicas" DROP CONSTRAINT "notas_clinicas_autorId_fkey";

-- DropForeignKey
ALTER TABLE "notas_clinicas_adendas" DROP CONSTRAINT "notas_clinicas_adendas_autorId_fkey";

-- DropForeignKey
ALTER TABLE "escalas_clinicas" DROP CONSTRAINT "escalas_clinicas_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "escalas_clinicas" DROP CONSTRAINT "escalas_clinicas_registadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "notas_turno" DROP CONSTRAINT "notas_turno_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "notas_turno" DROP CONSTRAINT "notas_turno_autorId_fkey";

-- DropForeignKey
ALTER TABLE "tarefas" DROP CONSTRAINT "tarefas_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "tarefas" DROP CONSTRAINT "tarefas_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "medicacoes" DROP CONSTRAINT "medicacoes_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "medicacoes" DROP CONSTRAINT "medicacoes_prescritoPorId_fkey";

-- DropForeignKey
ALTER TABLE "stewardship_antibiotico" DROP CONSTRAINT "stewardship_antibiotico_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "registos_medicacao" DROP CONSTRAINT "registos_medicacao_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "registos_medicacao" DROP CONSTRAINT "registos_medicacao_administradoPorId_fkey";

-- DropForeignKey
ALTER TABLE "escalas" DROP CONSTRAINT "escalas_criadaPorId_fkey";

-- DropForeignKey
ALTER TABLE "horarios_turno_profissionais" DROP CONSTRAINT "horarios_turno_profissionais_utilizadorId_fkey";

-- DropForeignKey
ALTER TABLE "pedidos_troca_turno" DROP CONSTRAINT "pedidos_troca_turno_solicitanteId_fkey";

-- DropForeignKey
ALTER TABLE "pedidos_troca_turno" DROP CONSTRAINT "pedidos_troca_turno_destinatarioId_fkey";

-- DropForeignKey
ALTER TABLE "atribuicoes_horario_turno" DROP CONSTRAINT "atribuicoes_horario_turno_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "atribuicoes_horario_turno" DROP CONSTRAINT "atribuicoes_horario_turno_utilizadorId_fkey";

-- DropForeignKey
ALTER TABLE "atribuicoes_horario_turno" DROP CONSTRAINT "atribuicoes_horario_turno_atribuidoPorId_fkey";

-- DropForeignKey
ALTER TABLE "sinais_vitais" DROP CONSTRAINT "sinais_vitais_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "sinais_vitais" DROP CONSTRAINT "sinais_vitais_registadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "balancos_hidricos" DROP CONSTRAINT "balancos_hidricos_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "balancos_hidricos" DROP CONSTRAINT "balancos_hidricos_registadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "avaliacoes_feridas" DROP CONSTRAINT "avaliacoes_feridas_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "avaliacoes_feridas" DROP CONSTRAINT "avaliacoes_feridas_registadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "pedidos_transfusao" DROP CONSTRAINT "pedidos_transfusao_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "pedidos_transfusao" DROP CONSTRAINT "pedidos_transfusao_prescritoPorId_fkey";

-- DropForeignKey
ALTER TABLE "registos_transfusao" DROP CONSTRAINT "registos_transfusao_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "registos_transfusao" DROP CONSTRAINT "registos_transfusao_administradoPorId_fkey";

-- DropForeignKey
ALTER TABLE "reacoes_transfusionais" DROP CONSTRAINT "reacoes_transfusionais_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "reacoes_transfusionais" DROP CONSTRAINT "reacoes_transfusionais_registadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "alergias" DROP CONSTRAINT "alergias_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "contactos_emergencia" DROP CONSTRAINT "contactos_emergencia_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "alertas_clinicos" DROP CONSTRAINT "alertas_clinicos_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "avaliacoes_risco" DROP CONSTRAINT "avaliacoes_risco_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "avaliacoes_risco" DROP CONSTRAINT "avaliacoes_risco_registadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "sumarios_alta" DROP CONSTRAINT "sumarios_alta_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "sumarios_alta" DROP CONSTRAINT "sumarios_alta_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "exames" DROP CONSTRAINT "exames_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "exames" DROP CONSTRAINT "exames_solicitadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "episodios_urgencia" DROP CONSTRAINT "episodios_urgencia_triadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "atualizacoes_transporte" DROP CONSTRAINT "atualizacoes_transporte_registadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "cirurgias_programadas" DROP CONSTRAINT "cirurgias_programadas_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "cirurgias_programadas" DROP CONSTRAINT "cirurgias_programadas_cirurgiaoId_fkey";

-- DropForeignKey
ALTER TABLE "consultas" DROP CONSTRAINT "consultas_medicoId_fkey";

-- DropForeignKey
ALTER TABLE "agenda_medico" DROP CONSTRAINT "agenda_medico_medicoId_fkey";

-- DropForeignKey
ALTER TABLE "pedidos_farmacia" DROP CONSTRAINT "pedidos_farmacia_solicitadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "ajustes_stock" DROP CONSTRAINT "ajustes_stock_utilizadorId_fkey";

-- DropForeignKey
ALTER TABLE "transferencias_stock" DROP CONSTRAINT "transferencias_stock_solicitadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "planos_reabilitacao" DROP CONSTRAINT "planos_reabilitacao_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "planos_reabilitacao" DROP CONSTRAINT "planos_reabilitacao_fisioterapeutaId_fkey";

-- DropForeignKey
ALTER TABLE "sessoes_fisioterapia" DROP CONSTRAINT "sessoes_fisioterapia_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "sessoes_fisioterapia" DROP CONSTRAINT "sessoes_fisioterapia_fisioterapeutaId_fkey";

-- DropForeignKey
ALTER TABLE "pedidos_internos" DROP CONSTRAINT "pedidos_internos_solicitadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "anuncios" DROP CONSTRAINT "anuncios_autorId_fkey";

-- DropForeignKey
ALTER TABLE "mensagens_internas" DROP CONSTRAINT "mensagens_internas_remetenteId_fkey";

-- DropForeignKey
ALTER TABLE "mensagens_internas" DROP CONSTRAINT "mensagens_internas_destinatarioId_fkey";

-- DropForeignKey
ALTER TABLE "interconsultas" DROP CONSTRAINT "interconsultas_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "interconsultas" DROP CONSTRAINT "interconsultas_requisitanteId_fkey";

-- DropForeignKey
ALTER TABLE "dispositivos_invasivos" DROP CONSTRAINT "dispositivos_invasivos_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "dispositivos_invasivos" DROP CONSTRAINT "dispositivos_invasivos_inseridoPorId_fkey";

-- DropForeignKey
ALTER TABLE "incidentes_ti" DROP CONSTRAINT "incidentes_ti_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "notas_incidentes_ti" DROP CONSTRAINT "notas_incidentes_ti_autorId_fkey";

-- DropForeignKey
ALTER TABLE "pedidos_ti" DROP CONSTRAINT "pedidos_ti_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "fichas_pessoais_doente" DROP CONSTRAINT "fichas_pessoais_doente_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "episodios_faturacao" DROP CONSTRAINT "episodios_faturacao_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "episodios_faturacao" DROP CONSTRAINT "episodios_faturacao_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "pagamentos" DROP CONSTRAINT "pagamentos_registadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "problemas_clinicos" DROP CONSTRAINT "problemas_clinicos_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "problemas_clinicos" DROP CONSTRAINT "problemas_clinicos_registadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "ausencias" DROP CONSTRAINT "ausencias_utilizadorId_fkey";

-- DropForeignKey
ALTER TABLE "trocas_folga" DROP CONSTRAINT "trocas_folga_solicitanteId_fkey";

-- DropForeignKey
ALTER TABLE "trocas_folga" DROP CONSTRAINT "trocas_folga_destinatarioId_fkey";

-- DropForeignKey
ALTER TABLE "formacoes_utilizadores" DROP CONSTRAINT "formacoes_utilizadores_utilizadorId_fkey";

-- DropForeignKey
ALTER TABLE "sessoes_especialidade" DROP CONSTRAINT "sessoes_especialidade_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "sessoes_especialidade" DROP CONSTRAINT "sessoes_especialidade_profissionalId_fkey";

-- DropForeignKey
ALTER TABLE "avaliacoes_desempenho" DROP CONSTRAINT "avaliacoes_desempenho_utilizadorId_fkey";

-- DropForeignKey
ALTER TABLE "avaliacoes_desempenho" DROP CONSTRAINT "avaliacoes_desempenho_avaliadorId_fkey";

-- DropForeignKey
ALTER TABLE "dados_contratuais" DROP CONSTRAINT "dados_contratuais_utilizadorId_fkey";

-- DropForeignKey
ALTER TABLE "consentimentos_informados" DROP CONSTRAINT "consentimentos_informados_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "consentimentos_informados" DROP CONSTRAINT "consentimentos_informados_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "break_glass_access" DROP CONSTRAINT "break_glass_access_utilizadorId_fkey";

-- DropForeignKey
ALTER TABLE "break_glass_access" DROP CONSTRAINT "break_glass_access_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "protocolos_clinicos" DROP CONSTRAINT "protocolos_clinicos_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "prescricoes_dieta" DROP CONSTRAINT "prescricoes_dieta_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "prescricoes_dieta" DROP CONSTRAINT "prescricoes_dieta_criadaPorId_fkey";

-- DropForeignKey
ALTER TABLE "culturas_microbiologicas" DROP CONSTRAINT "culturas_microbiologicas_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "culturas_microbiologicas" DROP CONSTRAINT "culturas_microbiologicas_registadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "surtos_iacs" DROP CONSTRAINT "surtos_iacs_registadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "sinalizacoes_preocupante" DROP CONSTRAINT "sinalizacoes_preocupante_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "sinalizacoes_preocupante" DROP CONSTRAINT "sinalizacoes_preocupante_criadaPorId_fkey";

-- DropForeignKey
ALTER TABLE "alertas_sepsis" DROP CONSTRAINT "alertas_sepsis_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "baselines_doente" DROP CONSTRAINT "baselines_doente_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "planos_alta" DROP CONSTRAINT "planos_alta_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "reconciliacoes_medicacao" DROP CONSTRAINT "reconciliacoes_medicacao_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "reconciliacoes_medicacao" DROP CONSTRAINT "reconciliacoes_medicacao_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "relatorios_passagem_turno" DROP CONSTRAINT "relatorios_passagem_turno_criadaPorId_fkey";

-- DropForeignKey
ALTER TABLE "acessos_familiares" DROP CONSTRAINT "acessos_familiares_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "acessos_familiares" DROP CONSTRAINT "acessos_familiares_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "identificadores_externos" DROP CONSTRAINT "identificadores_externos_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "documentos_saude" DROP CONSTRAINT "documentos_saude_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "ai_decisoes" DROP CONSTRAINT "ai_decisoes_utilizadorId_fkey";

-- DropForeignKey
ALTER TABLE "outcomes_clinicos" DROP CONSTRAINT "outcomes_clinicos_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "resultados_analise" DROP CONSTRAINT "resultados_analise_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "fotos_feridas" DROP CONSTRAINT "fotos_feridas_criadaPorId_fkey";

-- DropForeignKey
ALTER TABLE "registos_pro" DROP CONSTRAINT "registos_pro_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "portal_doentes" DROP CONSTRAINT "portal_doentes_criadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "followup_agendados" DROP CONSTRAINT "followup_agendados_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "followup_agendados" DROP CONSTRAINT "followup_agendados_responsavelId_fkey";

-- DropForeignKey
ALTER TABLE "gravidezes" DROP CONSTRAINT "gravidezes_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "planos_quimioterapia" DROP CONSTRAINT "planos_quimioterapia_doenteId_fkey";

-- DropForeignKey
ALTER TABLE "sessoes_dialise" DROP CONSTRAINT "sessoes_dialise_doenteId_fkey";

-- AlterTable
ALTER TABLE "notas_turno" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "motivoRemocao" TEXT,
ADD COLUMN     "removidoPorId" TEXT;

-- AlterTable
ALTER TABLE "balancos_hidricos" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "motivoRemocao" TEXT,
ADD COLUMN     "removidoPorId" TEXT;

-- AlterTable
ALTER TABLE "contactos_emergencia" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "motivoRemocao" TEXT,
ADD COLUMN     "removidoPorId" TEXT;

-- AlterTable
ALTER TABLE "documentos_saude" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "motivoRemocao" TEXT,
ADD COLUMN     "removidoPorId" TEXT;

-- AlterTable
ALTER TABLE "fotos_feridas" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "motivoRemocao" TEXT,
ADD COLUMN     "removidoPorId" TEXT;

-- AddForeignKey
ALTER TABLE "atribuicoes_doente" ADD CONSTRAINT "atribuicoes_doente_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_doente" ADD CONSTRAINT "atribuicoes_doente_enfermeiroId_fkey" FOREIGN KEY ("enfermeiroId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_entrada" ADD CONSTRAINT "horarios_entrada_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passagens_turno" ADD CONSTRAINT "passagens_turno_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_checkin" ADD CONSTRAINT "registos_checkin_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_clinicas" ADD CONSTRAINT "notas_clinicas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_clinicas" ADD CONSTRAINT "notas_clinicas_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_clinicas_adendas" ADD CONSTRAINT "notas_clinicas_adendas_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas_clinicas" ADD CONSTRAINT "escalas_clinicas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas_clinicas" ADD CONSTRAINT "escalas_clinicas_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_turno" ADD CONSTRAINT "notas_turno_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_turno" ADD CONSTRAINT "notas_turno_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicacoes" ADD CONSTRAINT "medicacoes_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicacoes" ADD CONSTRAINT "medicacoes_prescritoPorId_fkey" FOREIGN KEY ("prescritoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stewardship_antibiotico" ADD CONSTRAINT "stewardship_antibiotico_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_medicacao" ADD CONSTRAINT "registos_medicacao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_medicacao" ADD CONSTRAINT "registos_medicacao_administradoPorId_fkey" FOREIGN KEY ("administradoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_turno_profissionais" ADD CONSTRAINT "horarios_turno_profissionais_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_troca_turno" ADD CONSTRAINT "pedidos_troca_turno_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_troca_turno" ADD CONSTRAINT "pedidos_troca_turno_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_horario_turno" ADD CONSTRAINT "atribuicoes_horario_turno_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_horario_turno" ADD CONSTRAINT "atribuicoes_horario_turno_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atribuicoes_horario_turno" ADD CONSTRAINT "atribuicoes_horario_turno_atribuidoPorId_fkey" FOREIGN KEY ("atribuidoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinais_vitais" ADD CONSTRAINT "sinais_vitais_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinais_vitais" ADD CONSTRAINT "sinais_vitais_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balancos_hidricos" ADD CONSTRAINT "balancos_hidricos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balancos_hidricos" ADD CONSTRAINT "balancos_hidricos_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_feridas" ADD CONSTRAINT "avaliacoes_feridas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_feridas" ADD CONSTRAINT "avaliacoes_feridas_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_transfusao" ADD CONSTRAINT "pedidos_transfusao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_transfusao" ADD CONSTRAINT "pedidos_transfusao_prescritoPorId_fkey" FOREIGN KEY ("prescritoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_transfusao" ADD CONSTRAINT "registos_transfusao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_transfusao" ADD CONSTRAINT "registos_transfusao_administradoPorId_fkey" FOREIGN KEY ("administradoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reacoes_transfusionais" ADD CONSTRAINT "reacoes_transfusionais_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reacoes_transfusionais" ADD CONSTRAINT "reacoes_transfusionais_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alergias" ADD CONSTRAINT "alergias_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos_emergencia" ADD CONSTRAINT "contactos_emergencia_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_clinicos" ADD CONSTRAINT "alertas_clinicos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_risco" ADD CONSTRAINT "avaliacoes_risco_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_risco" ADD CONSTRAINT "avaliacoes_risco_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sumarios_alta" ADD CONSTRAINT "sumarios_alta_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sumarios_alta" ADD CONSTRAINT "sumarios_alta_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exames" ADD CONSTRAINT "exames_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exames" ADD CONSTRAINT "exames_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_urgencia" ADD CONSTRAINT "episodios_urgencia_triadoPorId_fkey" FOREIGN KEY ("triadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atualizacoes_transporte" ADD CONSTRAINT "atualizacoes_transporte_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cirurgias_programadas" ADD CONSTRAINT "cirurgias_programadas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cirurgias_programadas" ADD CONSTRAINT "cirurgias_programadas_cirurgiaoId_fkey" FOREIGN KEY ("cirurgiaoId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_medico" ADD CONSTRAINT "agenda_medico_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_farmacia" ADD CONSTRAINT "pedidos_farmacia_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_stock" ADD CONSTRAINT "ajustes_stock_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_stock" ADD CONSTRAINT "transferencias_stock_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_reabilitacao" ADD CONSTRAINT "planos_reabilitacao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_reabilitacao" ADD CONSTRAINT "planos_reabilitacao_fisioterapeutaId_fkey" FOREIGN KEY ("fisioterapeutaId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_fisioterapia" ADD CONSTRAINT "sessoes_fisioterapia_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_fisioterapia" ADD CONSTRAINT "sessoes_fisioterapia_fisioterapeutaId_fkey" FOREIGN KEY ("fisioterapeutaId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_internos" ADD CONSTRAINT "pedidos_internos_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anuncios" ADD CONSTRAINT "anuncios_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_internas" ADD CONSTRAINT "mensagens_internas_remetenteId_fkey" FOREIGN KEY ("remetenteId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_internas" ADD CONSTRAINT "mensagens_internas_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interconsultas" ADD CONSTRAINT "interconsultas_requisitanteId_fkey" FOREIGN KEY ("requisitanteId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_invasivos" ADD CONSTRAINT "dispositivos_invasivos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_invasivos" ADD CONSTRAINT "dispositivos_invasivos_inseridoPorId_fkey" FOREIGN KEY ("inseridoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes_ti" ADD CONSTRAINT "incidentes_ti_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_incidentes_ti" ADD CONSTRAINT "notas_incidentes_ti_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_ti" ADD CONSTRAINT "pedidos_ti_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_pessoais_doente" ADD CONSTRAINT "fichas_pessoais_doente_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_faturacao" ADD CONSTRAINT "episodios_faturacao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodios_faturacao" ADD CONSTRAINT "episodios_faturacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problemas_clinicos" ADD CONSTRAINT "problemas_clinicos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problemas_clinicos" ADD CONSTRAINT "problemas_clinicos_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trocas_folga" ADD CONSTRAINT "trocas_folga_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trocas_folga" ADD CONSTRAINT "trocas_folga_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formacoes_utilizadores" ADD CONSTRAINT "formacoes_utilizadores_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_especialidade" ADD CONSTRAINT "sessoes_especialidade_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_especialidade" ADD CONSTRAINT "sessoes_especialidade_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_desempenho" ADD CONSTRAINT "avaliacoes_desempenho_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_desempenho" ADD CONSTRAINT "avaliacoes_desempenho_avaliadorId_fkey" FOREIGN KEY ("avaliadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dados_contratuais" ADD CONSTRAINT "dados_contratuais_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimentos_informados" ADD CONSTRAINT "consentimentos_informados_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimentos_informados" ADD CONSTRAINT "consentimentos_informados_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "break_glass_access" ADD CONSTRAINT "break_glass_access_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "break_glass_access" ADD CONSTRAINT "break_glass_access_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocolos_clinicos" ADD CONSTRAINT "protocolos_clinicos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescricoes_dieta" ADD CONSTRAINT "prescricoes_dieta_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescricoes_dieta" ADD CONSTRAINT "prescricoes_dieta_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "culturas_microbiologicas" ADD CONSTRAINT "culturas_microbiologicas_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "culturas_microbiologicas" ADD CONSTRAINT "culturas_microbiologicas_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surtos_iacs" ADD CONSTRAINT "surtos_iacs_registadoPorId_fkey" FOREIGN KEY ("registadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinalizacoes_preocupante" ADD CONSTRAINT "sinalizacoes_preocupante_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinalizacoes_preocupante" ADD CONSTRAINT "sinalizacoes_preocupante_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_sepsis" ADD CONSTRAINT "alertas_sepsis_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baselines_doente" ADD CONSTRAINT "baselines_doente_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_alta" ADD CONSTRAINT "planos_alta_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliacoes_medicacao" ADD CONSTRAINT "reconciliacoes_medicacao_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliacoes_medicacao" ADD CONSTRAINT "reconciliacoes_medicacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios_passagem_turno" ADD CONSTRAINT "relatorios_passagem_turno_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acessos_familiares" ADD CONSTRAINT "acessos_familiares_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acessos_familiares" ADD CONSTRAINT "acessos_familiares_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identificadores_externos" ADD CONSTRAINT "identificadores_externos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_saude" ADD CONSTRAINT "documentos_saude_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decisoes" ADD CONSTRAINT "ai_decisoes_utilizadorId_fkey" FOREIGN KEY ("utilizadorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcomes_clinicos" ADD CONSTRAINT "outcomes_clinicos_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_analise" ADD CONSTRAINT "resultados_analise_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_feridas" ADD CONSTRAINT "fotos_feridas_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_pro" ADD CONSTRAINT "registos_pro_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_doentes" ADD CONSTRAINT "portal_doentes_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup_agendados" ADD CONSTRAINT "followup_agendados_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup_agendados" ADD CONSTRAINT "followup_agendados_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gravidezes" ADD CONSTRAINT "gravidezes_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_quimioterapia" ADD CONSTRAINT "planos_quimioterapia_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_dialise" ADD CONSTRAINT "sessoes_dialise_doenteId_fkey" FOREIGN KEY ("doenteId") REFERENCES "doentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

