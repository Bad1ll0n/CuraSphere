'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useSocket } from '@/lib/use-socket';
import { useTranslations } from 'next-intl';

/**
 * ARQ-14 — peças comuns aos painéis do dashboard (antes num ficheiro de 1 800 linhas).
 * Cada painel por papel está em ./paineis/.
 */
export const hoje = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });

export const hojeISO = new Date().toISOString().split('T')[0];

export const roleLabel: Record<string, string> = {
  medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
  tecnico_saude: 'Técnico de Saúde', farmaceutico: 'Farmacêutico',
  administrativo: 'Administrativo', operacional: 'Operacional',
  ti: 'TI', qualidade: 'Qualidade', direcao: 'Direção',
};

export const subRoleLabel: Record<string, string> = {
  ceo_hospitalar: 'CEO Hospitalar', diretor_medico: 'Diretor Médico', head_nurse: 'Head Nurse',
  cfo: 'CFO', coo: 'COO', hr_director: 'HR Director', cio: 'CIO', compliance_director: 'Compliance Director',
  clinico_geral: 'Clínico Geral', cardiologista: 'Cardiologista', urologista: 'Urologista',
  ortopedista: 'Ortopedista', neurologista: 'Neurologista', ginecologista: 'Ginecologista',
  pediatra: 'Pediatra', oncologista: 'Oncologista', cirurgiao_geral: 'Cirurgião Geral',
  medico_anestesia: 'Médico Anestesia', medico_imagem: 'Médico Imagem', anatomia_patologica: 'Anatomia Patológica',
  generalista: 'Generalista', enf_uci: 'UCI', enf_bloco: 'Bloco Operatório',
  enf_obstetricia: 'Obstetrícia', enf_pediatria: 'Pediatria', supervisor_enfermagem: 'Supervisor',
  tae: 'TAE', tecnico_radiologia: 'Radiologia', tecnico_tac_rm: 'TAC/RM',
  tecnico_analises_clinicas: 'Análises Clínicas', tecnico_cardiopneumologia: 'Cardiopneumologia',
  reabilitacao_fisica: 'Reabilitação Física', reabilitacao_fala: 'Reabilitação Fala',
  nutricao_clinica: 'Nutrição Clínica', psicologia_clinica: 'Psicologia Clínica',
  farmaceutico_hospitalar: 'Hospitalar', farmaceutico_oncologico: 'Oncológico', tecnico_farmacia_assist: 'Assistente',
  front_desk: 'Front Desk', secretariado: 'Secretariado', backoffice: 'Backoffice',
  scheduling: 'Scheduling', billing_officer: 'Billing Officer', hr_specialist: 'HR Specialist', procurement: 'Procurement',
  transporte_interno: 'Transporte Interno', apoio_geral: 'Apoio Geral', cssd: 'CSSD',
  higiene_hospitalar: 'Higiene Hospitalar', gestao_textil: 'Gestão Têxtil',
  equipamentos_medicos: 'Equipamentos Médicos', facilities: 'Facilities', vigilancia: 'Vigilância',
  seguranca_trabalho: 'Segurança Trabalho', sysadmin: 'SysAdmin', his_erp: 'HIS/ERP',
  database_admin: 'Database Admin', security_officer: 'Security Officer', dados_clinicos: 'Dados Clínicos',
  dpo_role: 'DPO', quality_manager: 'Quality Manager', compliance: 'Compliance',
  infection_control: 'Infection Control', internal_audit: 'Internal Audit',
};

export const estadoCor: Record<string, { badge: string; dot: string }> = {
  estavel:       { badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  grave:         { badge: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',   dot: 'bg-orange-500' },
  critico:       { badge: 'bg-red-50 text-red-700 ring-1 ring-red-200',            dot: 'bg-red-500' },
  alta_prevista: { badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',         dot: 'bg-blue-500' },
};

export const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

export const prioridadeCor: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700',
  alta:    'bg-orange-100 text-orange-700',
  media:   'bg-amber-100 text-amber-700',
  baixa:   'bg-slate-100 text-slate-600',
};

export function StatCard({ label, value, sub, color = 'bg-blue-600' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center`} style={{ marginBottom: '12px' }}>
        <span className="text-white font-bold text-base">{typeof value === 'number' ? value : '—'}</span>
      </div>
      <p className="text-slate-500 text-sm">{label}</p>
      <p className="text-3xl font-bold text-slate-900" style={{ marginTop: '4px' }}>{value}</p>
      {sub && <p className="text-xs text-slate-500" style={{ marginTop: '4px' }}>{sub}</p>}
    </div>
  );
}

export function EmBreve({ titulo, descricao }: { titulo: string; descricao?: string }) {
  const tCommon = useTranslations('common');
  return (
    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center" style={{ padding: '40px 24px' }}>
      <svg className="w-8 h-8 text-slate-300" style={{ marginBottom: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="font-semibold text-slate-500 text-sm">{titulo}</p>
      {descricao && <p className="text-slate-500 text-xs" style={{ marginTop: '6px' }}>{descricao}</p>}
      <span className="inline-block text-[10px] font-semibold badge-pad py-0.5 rounded-full bg-slate-200 text-slate-500" style={{ marginTop: '12px' }}>{tCommon('comingSoon')}</span>
    </div>
  );
}

export function SecaoTitulo({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-slate-700" style={{ marginBottom: '14px' }}>{children}</h2>;
}

export function CardContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>{children}</div>;
}

export function CardHeader({ title, count, countColor = 'bg-slate-100 text-slate-500' }: { title: string; count?: number | string; countColor?: string }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '18px 24px', borderBottom: '1px solid #f8fafc' }}>
      <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      {count !== undefined && (
        <span className={`text-xs font-semibold badge-pad py-1 rounded-full ${countColor}`}>{count}</span>
      )}
    </div>
  );
}

export function Vazio({ msg = 'Sem dados para mostrar' }: { msg?: string }) {
  return (
    <div className="flex items-center justify-center text-slate-500 text-sm" style={{ padding: '40px 24px' }}>{msg}</div>
  );
}

export function DashboardHeader({ utilizador }: { utilizador: { nome: string; role: string; subRole?: string; servico?: string } }) {
  const tRoles = useTranslations('roles');
  const tSubRoles = useTranslations('subRoles');
  const tDash = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const primeiro = utilizador.nome.split(' ')[0];
  const rl = tRoles.has(utilizador.role as any) ? tRoles(utilizador.role as any) : (roleLabel[utilizador.role] ?? utilizador.role);
  const sr = utilizador.subRole
    ? (tSubRoles.has(utilizador.subRole as any) ? tSubRoles(utilizador.subRole as any) : (subRoleLabel[utilizador.subRole] ?? utilizador.subRole))
    : null;
  const h = new Date().getHours();
  const saudacaoStr = h < 12 ? tDash('welcome') : h < 19 ? tDash('welcomeAfternoon') : tDash('welcomeEvening');
  return (
    <div className="flex items-start justify-between" style={{ marginBottom: '36px' }}>
      <div>
        <p className="text-sm text-slate-500 capitalize" style={{ marginBottom: '4px' }}>{hoje}</p>
        <h1 className="text-3xl font-bold text-slate-900">{saudacaoStr}, {primeiro} 👋</h1>
        <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
          <span className="text-xs font-medium badge-pad py-1 rounded-full bg-blue-100 text-blue-700">{rl}</span>
          {sr && <span className="text-xs font-medium badge-pad py-1 rounded-full bg-purple-100 text-purple-700">{sr}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl" style={{ padding: '8px 16px' }}>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-emerald-700 text-sm font-semibold">{tCommon('systemOnline')}</span>
      </div>
    </div>
  );
}

export interface SOSAlerta {
  doenteId: string;
  doenteNome: string;
  quarto?: string;
  acionadoPor?: string;
  alertaId?: string;
  ts: number;
}

export function useSOS() {
  const [alertas, setAlertas] = useState<SOSAlerta[]>([]);
  useSocket({
    'sos:alerta': (data: any) => {
      setAlertas(prev => [
        { doenteId: data.doenteId, doenteNome: data.doenteNome ?? 'Doente', quarto: data.quarto, acionadoPor: data.acionadoPor, alertaId: data.alertaId, ts: Date.now() },
        ...prev.filter(a => a.doenteId !== data.doenteId),
      ]);
    },
  });

  const acusar = async (alerta: SOSAlerta) => {
    if (alerta.alertaId) {
      await api.patch(`/alertas/${alerta.alertaId}/acusar`).catch(() => null);
    }
    setAlertas(prev => prev.filter(a => a.doenteId !== alerta.doenteId));
  };

  return { alertas, acusar };
}

export function SOSBannerGlobal() {
  const { alertas, acusar } = useSOS();
  if (alertas.length === 0) return null;
  return (
    <div className="flex flex-col gap-2" style={{ marginBottom: '20px' }}>
      {alertas.map(a => (
        <div key={a.doenteId} className="flex items-center gap-4 rounded-2xl border-2 border-red-400 bg-red-50 animate-pulse"
          style={{ padding: '16px 24px' }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="w-4 h-4 rounded-full bg-red-600 shrink-0 animate-ping" />
            <div>
              <p className="text-red-800 font-bold text-sm">🚨 SOS — {a.doenteNome}</p>
              <p className="text-red-700 text-xs">
                {a.quarto && `Quarto ${a.quarto}`}{a.acionadoPor ? ` · Acionado por ${a.acionadoPor}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/doentes/${a.doenteId}`}
              className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              style={{ padding: '8px 16px' }}>
              Ir para ficha
            </Link>
            <button onClick={() => acusar(a)}
              className="text-xs font-semibold border-2 border-red-400 text-red-700 hover:bg-red-100 rounded-lg transition-colors"
              style={{ padding: '7px 14px' }}>
              Acusar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export const TIPO_EXAME_LABELS: Record<string, string> = {
  analise_clinica: 'Análise Clínica', rx: 'Raio-X', eco: 'Ecografia',
  tc: 'TC', rmn: 'RMN', ecg: 'ECG', outro: 'Outro',
};

export function Spinner() {
  return (
    <div className="flex items-center justify-center gap-3 text-slate-500" style={{ paddingTop: '80px' }}>
      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-sm">A carregar dados...</span>
    </div>
  );
}
