-- CreateTable roles_config
CREATE TABLE "roles_config" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "roles_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable subroles_config
CREATE TABLE "subroles_config" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "roleChave" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "subroles_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_config_chave_key" ON "roles_config"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "subroles_config_chave_key" ON "subroles_config"("chave");

-- AddForeignKey
ALTER TABLE "subroles_config" ADD CONSTRAINT "subroles_config_roleChave_fkey" FOREIGN KEY ("roleChave") REFERENCES "roles_config"("chave") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Converter colunas enum → TEXT ───────────────────────────────────────────
ALTER TABLE "utilizadores" ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;
ALTER TABLE "utilizadores" ALTER COLUMN "subRole" TYPE TEXT USING "subRole"::TEXT;

-- ─── 1) Derivar subRole a partir da role antiga ───────────────────────────────
UPDATE "utilizadores" SET "subRole" = CASE
    WHEN "role" = 'diretor_geral'             THEN 'ceo_hospitalar'
    WHEN "role" = 'diretor_clinico'           THEN 'diretor_medico'
    WHEN "role" = 'diretor_enfermagem'        THEN 'head_nurse'
    WHEN "role" = 'diretor_financeiro'        THEN 'cfo'
    WHEN "role" = 'diretor_operacional'       THEN 'coo'
    WHEN "role" = 'diretor_rh'                THEN 'hr_director'
    WHEN "role" = 'diretor_ti'                THEN 'cio'
    WHEN "role" = 'diretor_qualidade'         THEN 'compliance_director'
    WHEN "role" = 'medico'                    THEN COALESCE("subRole", 'clinico_geral')
    WHEN "role" = 'medico_especialista'       THEN COALESCE("subRole", 'clinico_geral')
    WHEN "role" = 'cirurgiao'                 THEN 'cirurgiao_geral'
    WHEN "role" = 'anestesiologista'          THEN 'medico_anestesia'
    WHEN "role" = 'anestesista'               THEN 'medico_anestesia'
    WHEN "role" = 'radiologista'              THEN 'medico_imagem'
    WHEN "role" = 'patologista'               THEN 'anatomia_patologica'
    WHEN "role" = 'chefe_medicos'             THEN 'medico_gestor'
    WHEN "role" = 'enfermeiro'                THEN COALESCE("subRole", 'generalista')
    WHEN "role" = 'enfermeiro_especialista'   THEN COALESCE("subRole", 'generalista')
    WHEN "role" = 'enfermeiro_gestor'         THEN 'supervisor_enfermagem'
    WHEN "role" = 'chefe_enfermeiros'         THEN 'supervisor_enfermagem'
    WHEN "role" = 'chefe_turno'               THEN 'generalista'
    WHEN "role" = 'triador'                   THEN 'triador'
    WHEN "role" = 'instrumentista'            THEN 'instrumentista'
    WHEN "role" = 'auxiliar_saude'            THEN 'apoio_geral'
    WHEN "role" = 'auxiliar'                  THEN 'apoio_geral'
    WHEN "role" = 'tecnico'                   THEN 'tae'
    WHEN "role" = 'fisioterapeuta'            THEN 'reabilitacao_fisica'
    WHEN "role" = 'terapeuta_fala'            THEN 'reabilitacao_fala'
    WHEN "role" = 'nutricionista'             THEN 'nutricao_clinica'
    WHEN "role" = 'psicologo'                 THEN 'psicologia_clinica'
    WHEN "role" = 'farmaceutico'              THEN 'farmaceutico_hospitalar'
    WHEN "role" = 'farmaceutico_clinico'      THEN 'farmaceutico_oncologico'
    WHEN "role" = 'tecnico_farmacia'          THEN 'tecnico_farmacia_assist'
    WHEN "role" = 'rececionista'              THEN 'front_desk'
    WHEN "role" = 'secretario_clinico'        THEN 'secretariado'
    WHEN "role" = 'secretaria'                THEN 'secretariado'
    WHEN "role" = 'administrativo'            THEN 'backoffice'
    WHEN "role" = 'assistente_administrativo' THEN 'backoffice'
    WHEN "role" = 'gestor_agendamento'        THEN 'scheduling'
    WHEN "role" = 'faturacao'                 THEN 'billing_officer'
    WHEN "role" = 'rh'                        THEN 'hr_specialist'
    WHEN "role" = 'compras'                   THEN 'procurement'
    WHEN "role" = 'maqueiro'                  THEN 'transporte_interno'
    WHEN "role" = 'assistente_operacional'    THEN 'apoio_geral'
    WHEN "role" = 'esterilizacao'             THEN 'cssd'
    WHEN "role" = 'limpeza'                   THEN 'higiene_hospitalar'
    WHEN "role" = 'lavandaria'                THEN 'gestao_textil'
    WHEN "role" = 'engenheiro_biomedico'      THEN 'equipamentos_medicos'
    WHEN "role" = 'tecnico_manutencao'        THEN 'facilities'
    WHEN "role" = 'seguranca'                 THEN 'vigilancia'
    WHEN "role" = 'sst'                       THEN 'seguranca_trabalho'
    WHEN "role" = 'it_admin'                  THEN 'it_admin'
    WHEN "role" = 'analista_sistemas'         THEN 'his_erp'
    WHEN "role" = 'dba'                       THEN 'database_admin'
    WHEN "role" = 'ciberseguranca'            THEN 'security_officer'
    WHEN "role" = 'bi_analyst'                THEN 'dados_clinicos'
    WHEN "role" = 'dpo'                       THEN 'dpo_role'
    WHEN "role" = 'gestor_qualidade'          THEN 'quality_manager'
    WHEN "role" = 'compliance_officer'        THEN 'compliance'
    WHEN "role" = 'controlo_infecao'          THEN 'infection_control'
    WHEN "role" = 'auditor_interno'           THEN 'internal_audit'
    ELSE "subRole"
END;

-- ─── 2) Normalizar role para as 10 categorias fixas ──────────────────────────
UPDATE "utilizadores" SET "role" = CASE
    WHEN "role" IN ('diretor_geral','diretor_clinico','diretor_enfermagem','diretor_financeiro','diretor_operacional','diretor_rh') THEN 'direcao'
    WHEN "role" IN ('medico','medico_especialista','cirurgiao','anestesiologista','anestesista','radiologista','patologista','chefe_medicos') THEN 'medico'
    WHEN "role" IN ('enfermeiro','enfermeiro_especialista','enfermeiro_gestor','chefe_enfermeiros','chefe_turno','triador','instrumentista') THEN 'enfermeiro'
    WHEN "role" IN ('auxiliar_saude','auxiliar') THEN 'auxiliar'
    WHEN "role" IN ('tecnico','fisioterapeuta','terapeuta_fala','nutricionista','psicologo') THEN 'tecnico_saude'
    WHEN "role" IN ('farmaceutico','farmaceutico_clinico','tecnico_farmacia') THEN 'farmaceutico'
    WHEN "role" IN ('rececionista','secretario_clinico','secretaria','assistente_administrativo','administrativo','gestor_agendamento','faturacao','rh','compras') THEN 'administrativo'
    WHEN "role" IN ('maqueiro','assistente_operacional','esterilizacao','limpeza','lavandaria','engenheiro_biomedico','tecnico_manutencao','seguranca','sst') THEN 'operacional'
    WHEN "role" IN ('it_admin','diretor_ti','analista_sistemas','dba','ciberseguranca','bi_analyst') THEN 'ti'
    WHEN "role" IN ('dpo','gestor_qualidade','compliance_officer','controlo_infecao','auditor_interno','diretor_qualidade') THEN 'qualidade'
    ELSE "role"
END;

-- ─── 3) Remover enums antigos ─────────────────────────────────────────────────
DROP TYPE IF EXISTS "Role";
DROP TYPE IF EXISTS "SubRole";
