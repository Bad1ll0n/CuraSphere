-- CreateEnum
CREATE TYPE "SubRole" AS ENUM ('ceo_hospitalar', 'diretor_medico', 'head_nurse', 'cfo', 'coo', 'hr_director', 'cio', 'compliance_director', 'clinico_geral', 'cardiologista', 'urologista', 'ortopedista', 'neurologista', 'ginecologista', 'pediatra', 'oncologista', 'cirurgiao_geral', 'medico_anestesia', 'medico_imagem', 'anatomia_patologica', 'generalista', 'enf_uci', 'enf_bloco', 'enf_obstetricia', 'enf_pediatria', 'supervisor_enfermagem', 'tae', 'tecnico_radiologia', 'tecnico_tac_rm', 'tecnico_analises_clinicas', 'tecnico_cardiopneumologia', 'reabilitacao_fisica', 'reabilitacao_fala', 'nutricao_clinica', 'psicologia_clinica', 'farmaceutico_hospitalar', 'farmaceutico_oncologico', 'tecnico_farmacia_assist', 'front_desk', 'secretariado', 'backoffice', 'scheduling', 'billing_officer', 'hr_specialist', 'procurement', 'transporte_interno', 'apoio_geral', 'cssd', 'higiene_hospitalar', 'gestao_textil', 'equipamentos_medicos', 'facilities', 'vigilancia', 'seguranca_trabalho', 'sysadmin', 'his_erp', 'database_admin', 'security_officer', 'dados_clinicos', 'dpo_role', 'quality_manager', 'compliance', 'infection_control', 'internal_audit');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'diretor_geral';
ALTER TYPE "Role" ADD VALUE 'diretor_clinico';
ALTER TYPE "Role" ADD VALUE 'diretor_enfermagem';
ALTER TYPE "Role" ADD VALUE 'diretor_financeiro';
ALTER TYPE "Role" ADD VALUE 'diretor_operacional';
ALTER TYPE "Role" ADD VALUE 'diretor_rh';
ALTER TYPE "Role" ADD VALUE 'diretor_ti';
ALTER TYPE "Role" ADD VALUE 'diretor_qualidade';
ALTER TYPE "Role" ADD VALUE 'medico_especialista';
ALTER TYPE "Role" ADD VALUE 'anestesiologista';
ALTER TYPE "Role" ADD VALUE 'radiologista';
ALTER TYPE "Role" ADD VALUE 'patologista';
ALTER TYPE "Role" ADD VALUE 'enfermeiro_especialista';
ALTER TYPE "Role" ADD VALUE 'enfermeiro_gestor';
ALTER TYPE "Role" ADD VALUE 'auxiliar_saude';
ALTER TYPE "Role" ADD VALUE 'tecnico';
ALTER TYPE "Role" ADD VALUE 'terapeuta_fala';
ALTER TYPE "Role" ADD VALUE 'nutricionista';
ALTER TYPE "Role" ADD VALUE 'psicologo';
ALTER TYPE "Role" ADD VALUE 'farmaceutico_clinico';
ALTER TYPE "Role" ADD VALUE 'rececionista';
ALTER TYPE "Role" ADD VALUE 'secretario_clinico';
ALTER TYPE "Role" ADD VALUE 'assistente_administrativo';
ALTER TYPE "Role" ADD VALUE 'gestor_agendamento';
ALTER TYPE "Role" ADD VALUE 'faturacao';
ALTER TYPE "Role" ADD VALUE 'rh';
ALTER TYPE "Role" ADD VALUE 'compras';
ALTER TYPE "Role" ADD VALUE 'maqueiro';
ALTER TYPE "Role" ADD VALUE 'assistente_operacional';
ALTER TYPE "Role" ADD VALUE 'esterilizacao';
ALTER TYPE "Role" ADD VALUE 'limpeza';
ALTER TYPE "Role" ADD VALUE 'lavandaria';
ALTER TYPE "Role" ADD VALUE 'engenheiro_biomedico';
ALTER TYPE "Role" ADD VALUE 'tecnico_manutencao';
ALTER TYPE "Role" ADD VALUE 'seguranca';
ALTER TYPE "Role" ADD VALUE 'sst';
ALTER TYPE "Role" ADD VALUE 'it_admin';
ALTER TYPE "Role" ADD VALUE 'analista_sistemas';
ALTER TYPE "Role" ADD VALUE 'dba';
ALTER TYPE "Role" ADD VALUE 'ciberseguranca';
ALTER TYPE "Role" ADD VALUE 'bi_analyst';
ALTER TYPE "Role" ADD VALUE 'dpo';
ALTER TYPE "Role" ADD VALUE 'gestor_qualidade';
ALTER TYPE "Role" ADD VALUE 'compliance_officer';
ALTER TYPE "Role" ADD VALUE 'controlo_infecao';
ALTER TYPE "Role" ADD VALUE 'auditor_interno';

-- AlterTable
ALTER TABLE "utilizadores" ADD COLUMN     "subRole" "SubRole";
