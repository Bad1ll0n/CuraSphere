'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar,
} from 'recharts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 19) return 'Boa tarde';
  return 'Boa noite';
}

const hoje = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
const hojeISO = new Date().toISOString().split('T')[0];

const roleLabel: Record<string, string> = {
  diretor_geral: 'Diretor Geral', diretor_clinico: 'Diretor Clínico', diretor_enfermagem: 'Diretor de Enfermagem',
  diretor_financeiro: 'Diretor Financeiro', diretor_operacional: 'Diretor Operacional', diretor_rh: 'Diretor de RH',
  diretor_ti: 'Diretor de TI', diretor_qualidade: 'Diretor de Qualidade',
  medico: 'Médico', medico_especialista: 'Médico Especialista', cirurgiao: 'Cirurgião',
  anestesiologista: 'Anestesiologista', radiologista: 'Radiologista', patologista: 'Patologista',
  enfermeiro: 'Enfermeiro', enfermeiro_especialista: 'Enfermeiro Especialista', enfermeiro_gestor: 'Enfermeiro Gestor',
  auxiliar_saude: 'Auxiliar de Saúde', tecnico: 'Técnico', fisioterapeuta: 'Fisioterapeuta',
  terapeuta_fala: 'Terapeuta da Fala', nutricionista: 'Nutricionista', psicologo: 'Psicólogo',
  farmaceutico: 'Farmacêutico', farmaceutico_clinico: 'Farmacêutico Clínico', tecnico_farmacia: 'Técnico de Farmácia',
  rececionista: 'Rececionista', secretario_clinico: 'Secretário Clínico', assistente_administrativo: 'Assistente Administrativo',
  gestor_agendamento: 'Gestor de Agendamento', faturacao: 'Faturação', rh: 'RH', compras: 'Compras',
  maqueiro: 'Maqueiro', assistente_operacional: 'Assistente Operacional', esterilizacao: 'Esterilização',
  limpeza: 'Limpeza', lavandaria: 'Lavandaria', engenheiro_biomedico: 'Engenheiro Biomédico',
  tecnico_manutencao: 'Técnico de Manutenção', seguranca: 'Segurança', sst: 'SST',
  it_admin: 'IT Admin', analista_sistemas: 'Analista de Sistemas', dba: 'DBA',
  ciberseguranca: 'Cibersegurança', bi_analyst: 'BI Analyst', dpo: 'DPO',
  gestor_qualidade: 'Gestor de Qualidade', compliance_officer: 'Compliance Officer',
  controlo_infecao: 'Controlo de Infeção', auditor_interno: 'Auditor Interno',
  auxiliar: 'Auxiliar', administrativo: 'Administrativo', chefe_turno: 'Chefe de Turno',
  chefe_enfermeiros: 'Chefe de Enfermeiros', chefe_medicos: 'Chefe de Médicos',
  triador: 'Triador', anestesista: 'Anestesista', instrumentista: 'Instrumentista', secretaria: 'Secretária',
};

const subRoleLabel: Record<string, string> = {
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

const estadoCor: Record<string, { badge: string; dot: string }> = {
  estavel:       { badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  grave:         { badge: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',   dot: 'bg-orange-500' },
  critico:       { badge: 'bg-red-50 text-red-700 ring-1 ring-red-200',            dot: 'bg-red-500' },
  alta_prevista: { badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',         dot: 'bg-blue-500' },
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

const prioridadeCor: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700',
  alta:    'bg-orange-100 text-orange-700',
  media:   'bg-amber-100 text-amber-700',
  baixa:   'bg-slate-100 text-slate-600',
};

// ─── Componentes de apoio ─────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'bg-blue-600' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center`} style={{ marginBottom: '12px' }}>
        <span className="text-white font-bold text-base">{typeof value === 'number' ? value : '—'}</span>
      </div>
      <p className="text-slate-500 text-sm">{label}</p>
      <p className="text-3xl font-bold text-slate-900" style={{ marginTop: '4px' }}>{value}</p>
      {sub && <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>{sub}</p>}
    </div>
  );
}

function EmBreve({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center" style={{ padding: '40px 24px' }}>
      <svg className="w-8 h-8 text-slate-300" style={{ marginBottom: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="font-semibold text-slate-500 text-sm">{titulo}</p>
      {descricao && <p className="text-slate-400 text-xs" style={{ marginTop: '6px' }}>{descricao}</p>}
      <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500" style={{ marginTop: '12px' }}>Em breve</span>
    </div>
  );
}

function SecaoTitulo({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-slate-700" style={{ marginBottom: '14px' }}>{children}</h2>;
}

function CardContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>{children}</div>;
}

function CardHeader({ title, count, countColor = 'bg-slate-100 text-slate-500' }: { title: string; count?: number | string; countColor?: string }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '18px 24px', borderBottom: '1px solid #f8fafc' }}>
      <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      {count !== undefined && (
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${countColor}`}>{count}</span>
      )}
    </div>
  );
}

function Vazio({ msg = 'Sem dados para mostrar' }: { msg?: string }) {
  return (
    <div className="flex items-center justify-center text-slate-400 text-sm" style={{ padding: '40px 24px' }}>{msg}</div>
  );
}

// ─── Header universal ─────────────────────────────────────────────────────────

function DashboardHeader({ utilizador }: { utilizador: { nome: string; role: string; subRole?: string; servico?: string } }) {
  const primeiro = utilizador.nome.split(' ')[0];
  const rl = roleLabel[utilizador.role] ?? utilizador.role;
  const sr = utilizador.subRole ? (subRoleLabel[utilizador.subRole] ?? utilizador.subRole) : null;
  return (
    <div className="flex items-start justify-between" style={{ marginBottom: '36px' }}>
      <div>
        <p className="text-sm text-slate-400 capitalize" style={{ marginBottom: '4px' }}>{hoje}</p>
        <h1 className="text-3xl font-bold text-slate-900">{saudacao()}, {primeiro} 👋</h1>
        <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">{rl}</span>
          {sr && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">{sr}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl" style={{ padding: '8px 16px' }}>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-emerald-700 text-sm font-semibold">Sistema Online</span>
      </div>
    </div>
  );
}

// ─── Vista 1: Médico ──────────────────────────────────────────────────────────

function DashboardMedico({ utilizador }: { utilizador: any }) {
  const [doentes, setDoentes] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/doentes?todos=true').catch(() => ({ data: [] })),
      api.get('/tarefas/minhas').catch(() => ({ data: [] })),
    ]).then(([d, t]) => {
      setDoentes(d.data ?? []);
      setTarefas((t.data ?? []).filter((x: any) => x.estado !== 'concluida' && x.estado !== 'cancelada'));
    }).finally(() => setLoading(false));
  }, []);

  const criticos = doentes.filter((d: any) => d.estado === 'critico' || d.estado === 'grave');
  const urgentes = tarefas.filter((t: any) => t.prioridade === 'urgente' || t.prioridade === 'alta');

  if (loading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-4 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Doentes Internados" value={doentes.length} color="bg-violet-600" />
        <StatCard label="Estado Crítico/Grave" value={criticos.length} color={criticos.length > 0 ? 'bg-red-500' : 'bg-emerald-500'} />
        <StatCard label="Tarefas Pendentes" value={tarefas.length} color="bg-amber-500" />
        <StatCard label="Urgentes" value={urgentes.length} color={urgentes.length > 0 ? 'bg-orange-500' : 'bg-slate-400'} />
      </div>

      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>
        <CardContainer>
          <CardHeader title="Doentes — Lista Geral" count={doentes.length} />
          {doentes.length === 0 ? <Vazio msg="Sem doentes internados" /> : (
            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {doentes.map((d: any, i: number) => (
                <Link key={d.id} href={`/doentes/${d.id}`}>
                  <div className="flex items-center justify-between hover:bg-slate-50 transition-colors" style={{ padding: '12px 24px', borderBottom: i < doentes.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${estadoCor[d.estado]?.dot ?? 'bg-slate-300'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{d.nome}</p>
                        <p className="text-xs text-slate-400 truncate">{d.diagnosticoPrincipal}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400">Cama {d.cama?.numero}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoCor[d.estado]?.badge ?? 'bg-slate-100 text-slate-600'}`}>{estadoLabel[d.estado] ?? d.estado}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContainer>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <CardContainer>
            <CardHeader title="Tarefas Clínicas Urgentes" count={urgentes.length} countColor={urgentes.length > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'} />
            {urgentes.length === 0 ? <Vazio msg="Sem tarefas urgentes" /> : (
              <div>
                {urgentes.slice(0, 5).map((t: any, i: number) => (
                  <div key={t.id} className="flex items-center justify-between" style={{ padding: '10px 24px', borderBottom: i < urgentes.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <p className="text-sm text-slate-700 truncate">{t.descricao}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${prioridadeCor[t.prioridade] ?? 'bg-slate-100 text-slate-600'}`}>{t.prioridade}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContainer>
          <EmBreve titulo="Interconsultas Pendentes" descricao="Fase 7.2 — Referenciação entre Especialidades" />
          <EmBreve titulo="Exames com Resultado" descricao="Fase 7.3 — Worklist de Imagiologia" />
        </div>
      </div>
    </>
  );
}

// ─── Vista 2: Bloco Operatório ────────────────────────────────────────────────

function DashboardBloco({ utilizador }: { utilizador: any }) {
  const [cirurgias, setCirurgias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/bloco/agenda?data=${hojeISO}`).catch(() => ({ data: [] }))
      .then((r) => setCirurgias(r.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const estadosCirurgia: Record<string, { badge: string; label: string }> = {
    agendada:  { badge: 'bg-blue-100 text-blue-700',    label: 'Agendada' },
    em_curso:  { badge: 'bg-orange-100 text-orange-700',label: 'Em Curso' },
    concluida: { badge: 'bg-emerald-100 text-emerald-700', label: 'Concluída' },
    cancelada: { badge: 'bg-red-100 text-red-700',      label: 'Cancelada' },
    adiada:    { badge: 'bg-slate-100 text-slate-600',  label: 'Adiada' },
  };

  if (loading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-4 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Cirurgias Hoje" value={cirurgias.length} color="bg-red-600" />
        <StatCard label="Em Curso" value={cirurgias.filter((c: any) => c.estado === 'em_curso').length} color="bg-orange-500" />
        <StatCard label="Concluídas" value={cirurgias.filter((c: any) => c.estado === 'concluida').length} color="bg-emerald-500" />
        <StatCard label="Canceladas" value={cirurgias.filter((c: any) => c.estado === 'cancelada').length} color="bg-slate-400" />
      </div>

      <SecaoTitulo>Agenda de Hoje</SecaoTitulo>
      {cirurgias.length === 0 ? (
        <CardContainer><Vazio msg="Sem cirurgias agendadas para hoje" /></CardContainer>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {cirurgias.map((c: any) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{c.designacao}</p>
                  <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>{c.doente?.nome ?? 'Doente'} · Sala {c.sala}</p>
                  <p className="text-sm text-slate-400" style={{ marginTop: '2px' }}>
                    {new Date(c.dataHora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · {c.duracaoPrevista}min previstos
                  </p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${estadosCirurgia[c.estado]?.badge ?? 'bg-slate-100 text-slate-600'}`}>
                  {estadosCirurgia[c.estado]?.label ?? c.estado}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        <EmBreve titulo="WHO Surgical Safety Checklist" descricao="Fase 7.4 — Verificação pré/intra/pós cirúrgica" />
        <EmBreve titulo="Registo Intra-operatório" descricao="Tempo real, intercorrências, consumo de material" />
      </div>
    </>
  );
}

// ─── Vista 3: Imagiologia & Lab ───────────────────────────────────────────────

const TIPO_EXAME_LABELS: Record<string, string> = {
  analise_clinica: 'Análise Clínica', rx: 'Raio-X', eco: 'Ecografia',
  tc: 'TC', rmn: 'RMN', ecg: 'ECG', outro: 'Outro',
};

function DashboardImagiologia({ utilizador }: { utilizador: any }) {
  const [worklist, setWorklist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [resultadoModal, setResultadoModal] = useState<any | null>(null);
  const [resultadoTexto, setResultadoTexto] = useState('');
  const [salvandoResultado, setSalvandoResultado] = useState(false);

  const carregar = async () => {
    try {
      const r = await api.get('/exames/worklist');
      setWorklist(r.data);
    } catch { setWorklist([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const iniciarExame = async (id: string) => {
    setAtualizando(id);
    try { await api.patch(`/exames/${id}/estado`, { estado: 'em_progresso' }); await carregar(); }
    finally { setAtualizando(null); }
  };

  const registarResultado = async () => {
    if (!resultadoModal || !resultadoTexto.trim()) return;
    setSalvandoResultado(true);
    try {
      await api.patch(`/exames/${resultadoModal.id}/resultado`, { resultado: resultadoTexto });
      setResultadoModal(null); setResultadoTexto(''); await carregar();
    } finally { setSalvandoResultado(false); }
  };

  const urgentes = worklist.filter(e => e.urgente).length;
  const emProgresso = worklist.filter(e => e.estado === 'em_progresso').length;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-3 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Exames Pendentes" value={worklist.length} color="bg-sky-500" sub={`${emProgresso} em progresso`} />
        <StatCard label="Urgentes" value={urgentes} color={urgentes > 0 ? 'bg-red-500' : 'bg-slate-400'} />
        <StatCard label="Relatórios Emitidos Hoje" value={0} color="bg-slate-400" sub="Em breve" />
      </div>

      <SecaoTitulo>Worklist — Exames Pendentes</SecaoTitulo>
      <CardContainer>
        {loading ? (
          <Spinner />
        ) : worklist.length === 0 ? (
          <Vazio msg="Worklist limpa — sem exames pendentes" />
        ) : (
          <div className="flex flex-col gap-3">
            {worklist.map(e => (
              <div key={e.id} className={`rounded-xl border flex items-start justify-between gap-3 ${e.urgente ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`} style={{ padding: '14px 16px' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2" style={{ marginBottom: '4px' }}>
                    <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                      {TIPO_EXAME_LABELS[e.tipo] ?? e.tipo}
                    </span>
                    {e.urgente && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">URGENTE</span>}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.estado === 'em_progresso' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {e.estado === 'em_progresso' ? 'Em progresso' : 'Aguarda'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{e.descricao}</p>
                  <p className="text-xs text-slate-500 font-semibold" style={{ marginTop: '4px' }}>
                    {e.doente?.nome} · Processo {e.doente?.numeroProcesso}
                    {e.doente?.cama && ` · Cama ${e.doente.cama.numero}`}
                  </p>
                  <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>
                    Solicitado por {e.solicitadoPor?.nome} · {new Date(e.criadoEm).toLocaleDateString('pt-PT')} {new Date(e.criadoEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {e.estado === 'solicitado' && (
                    <button onClick={() => iniciarExame(e.id)} disabled={atualizando === e.id}
                      className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      style={{ padding: '6px 12px' }}>
                      {atualizando === e.id ? '...' : 'Iniciar'}
                    </button>
                  )}
                  <button onClick={() => { setResultadoModal(e); setResultadoTexto(''); }}
                    className="text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors"
                    style={{ padding: '6px 12px' }}>
                    Resultado
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContainer>

      {/* Link para worklist completa */}
      <div className="flex justify-center" style={{ marginTop: '20px' }}>
        <a href="/worklist"
          className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:text-sky-800 transition-colors">
          Ver worklist completa com filtros
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* Modal Resultado */}
      {resultadoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '460px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <h2 className="text-lg font-bold text-slate-900">Registar Resultado</h2>
              <button onClick={() => setResultadoModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-sm text-slate-600 bg-slate-50 rounded-xl" style={{ padding: '10px 14px', marginBottom: '20px' }}>
              <strong>{TIPO_EXAME_LABELS[resultadoModal.tipo]}</strong> — {resultadoModal.descricao}<br />
              <span className="text-slate-400">{resultadoModal.doente?.nome}</span>
            </p>
            <textarea value={resultadoTexto} onChange={e => setResultadoTexto(e.target.value)}
              rows={5} placeholder="Descreva os achados e resultado..." className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              style={{ padding: '10px 14px', marginBottom: '20px' }} />
            <div className="flex gap-3">
              <button onClick={() => setResultadoModal(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={registarResultado} disabled={salvandoResultado || !resultadoTexto.trim()}
                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvandoResultado ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Vista 4: Enfermeiro ──────────────────────────────────────────────────────

function DashboardEnfermeiro({ utilizador }: { utilizador: any }) {
  const [doentes, setDoentes] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [turno, setTurno] = useState<any>(null);
  const [mensagensNaoLidas, setMensagensNaoLidas] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/doentes').catch(() => ({ data: [] })),
      api.get('/tarefas/minhas').catch(() => ({ data: [] })),
      api.get('/turnos/ativo').catch(() => ({ data: null })),
      api.get('/comunicacao/mensagens/nao-lidas').catch(() => ({ data: { count: 0 } })),
    ]).then(([d, t, turnoR, msg]) => {
      setDoentes(d.data ?? []);
      setTarefas((t.data ?? []).filter((x: any) => x.estado !== 'concluida' && x.estado !== 'cancelada'));
      setTurno(turnoR.data);
      setMensagensNaoLidas(msg.data?.count ?? msg.data?.length ?? 0);
    }).finally(() => setLoading(false));
  }, []);

  const urgentes = tarefas.filter((t: any) => t.prioridade === 'urgente' || t.prioridade === 'alta');
  const isUCI = utilizador.subRole === 'enf_uci';

  if (loading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className={`grid grid-cols-4 gap-5`} style={{ marginBottom: '32px' }}>
        <StatCard label="Doentes Atribuídos" value={doentes.length} color="bg-teal-600" />
        <StatCard label="Tarefas Pendentes" value={tarefas.length} color="bg-amber-500" />
        <StatCard label="Tarefas Urgentes" value={urgentes.length} color={urgentes.length > 0 ? 'bg-red-500' : 'bg-emerald-500'} />
        <StatCard label="Mensagens Não Lidas" value={mensagensNaoLidas} color={mensagensNaoLidas > 0 ? 'bg-blue-600' : 'bg-slate-400'} />
      </div>

      {turno && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl flex items-center gap-3" style={{ padding: '14px 20px', marginBottom: '24px' }}>
          <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          <p className="text-teal-800 text-sm font-medium">
            Turno {turno.tipo === 'manha' ? 'Manhã' : turno.tipo === 'tarde' ? 'Tarde' : 'Noite'} em curso ·{' '}
            {new Date(turno.dataInicio).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} —{' '}
            {new Date(turno.dataFim).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>
        <CardContainer>
          <CardHeader title="Meus Doentes" count={doentes.length} countColor="bg-teal-100 text-teal-700" />
          {doentes.length === 0 ? <Vazio msg="Sem doentes atribuídos neste turno" /> : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {doentes.map((d: any, i: number) => (
                <Link key={d.id} href={`/doentes/${d.id}`}>
                  <div className="flex items-center justify-between hover:bg-slate-50 transition-colors" style={{ padding: '12px 24px', borderBottom: i < doentes.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${estadoCor[d.estado]?.dot ?? 'bg-slate-300'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{d.nome}</p>
                        <p className="text-xs text-slate-400">Cama {d.cama?.numero} · Quarto {d.cama?.quarto}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${estadoCor[d.estado]?.badge ?? 'bg-slate-100 text-slate-600'}`}>{estadoLabel[d.estado] ?? d.estado}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContainer>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <CardContainer>
            <CardHeader title="Tarefas Urgentes / Alta Prioridade" count={urgentes.length} countColor={urgentes.length > 0 ? 'bg-red-100 text-red-700' : undefined} />
            {urgentes.length === 0 ? <Vazio msg="Sem tarefas urgentes" /> : (
              <div>
                {urgentes.slice(0, 5).map((t: any, i: number) => (
                  <div key={t.id} className="flex items-center justify-between" style={{ padding: '10px 24px', borderBottom: i < Math.min(urgentes.length, 5) - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 truncate">{t.descricao}</p>
                      <p className="text-xs text-slate-400">{t.doente?.nome ?? ''}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${prioridadeCor[t.prioridade] ?? 'bg-slate-100 text-slate-600'}`}>{t.prioridade}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContainer>
          <EmBreve titulo="Medicações Pendentes (MAR)" descricao="Registo de Administração de Medicação — Fase 7" />
          {isUCI && <EmBreve titulo="Dispositivos Invasivos" descricao="Cateteres, ventiladores, drenos — Fase 7" />}
        </div>
      </div>
    </>
  );
}

// ─── Vista 5: Chefe de Enfermagem ─────────────────────────────────────────────

function DashboardChefeEnfermagem({ utilizador }: { utilizador: any }) {
  const [ocupacao, setOcupacao] = useState<any>(null);
  const [doentes, setDoentes] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [trocas, setTrocas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/camas/ocupacao').catch(() => ({ data: null })),
      api.get('/doentes?todos=true').catch(() => ({ data: [] })),
      api.get('/dashboard/analytics').catch(() => ({ data: null })),
      api.get('/trocas').catch(() => ({ data: [] })),
    ]).then(([o, d, a, t]) => {
      setOcupacao(o.data);
      setDoentes(d.data ?? []);
      setAnalytics(a.data);
      setTrocas((t.data ?? []).filter((x: any) => x.estado === 'pendente_chefe'));
    }).finally(() => setLoading(false));
  }, []);

  const criticos = doentes.filter((d: any) => d.estado === 'critico');
  const altasHoje = doentes.filter((d: any) => d.dataAltaPrevista && new Date(d.dataAltaPrevista).toDateString() === new Date().toDateString());

  if (loading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-4 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Camas Ocupadas" value={ocupacao?.ocupadas ?? 0} sub={`de ${ocupacao?.total ?? 0} total · ${ocupacao?.total ? Math.round((ocupacao.ocupadas / ocupacao.total) * 100) : 0}%`} color="bg-slate-700" />
        <StatCard label="Camas Livres" value={ocupacao?.livres ?? 0} color="bg-emerald-500" />
        <StatCard label="Doentes Críticos" value={criticos.length} color={criticos.length > 0 ? 'bg-red-500' : 'bg-emerald-500'} />
        <StatCard label="Trocas Pendentes" value={trocas.length} color={trocas.length > 0 ? 'bg-amber-500' : 'bg-slate-400'} />
      </div>

      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>
        {analytics?.cargaEnfermeiros && analytics.cargaEnfermeiros.length > 0 ? (
          <CardContainer>
            <CardHeader title="Carga por Enfermeiro — Turno Atual" />
            <div style={{ padding: '16px 24px' }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics.cargaEnfermeiros} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" width={90} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: string) => v.split(' ')[0]} />
                  <Tooltip formatter={(v, name) => [v, name === 'numDoentes' ? 'Doentes' : 'Tarefas']} />
                  <Legend formatter={(v) => v === 'numDoentes' ? 'Doentes' : 'Tarefas'} />
                  <Bar dataKey="numDoentes" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="tarefasPendentes" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContainer>
        ) : (
          <CardContainer><CardHeader title="Carga por Enfermeiro" /><Vazio msg="Sem atribuições no turno atual" /></CardContainer>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <CardContainer>
            <CardHeader title="Trocas de Turno Pendentes" count={trocas.length} countColor={trocas.length > 0 ? 'bg-amber-100 text-amber-700' : undefined} />
            {trocas.length === 0 ? <Vazio msg="Sem trocas para aprovar" /> : (
              <div>
                {trocas.slice(0, 4).map((t: any, i: number) => (
                  <div key={t.id} className="flex items-center justify-between" style={{ padding: '10px 24px', borderBottom: i < trocas.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <p className="text-sm text-slate-700 truncate">{t.solicitante?.nome ?? '—'} ↔ {t.destinatario?.nome ?? '—'}</p>
                    <Link href="/trocas" className="text-xs text-blue-600 hover:underline shrink-0 ml-2">Ver</Link>
                  </div>
                ))}
              </div>
            )}
          </CardContainer>

          <CardContainer>
            <CardHeader title="Altas Previstas Hoje" count={altasHoje.length} countColor={altasHoje.length > 0 ? 'bg-blue-100 text-blue-700' : undefined} />
            {altasHoje.length === 0 ? <Vazio msg="Sem altas previstas" /> : (
              <div>
                {altasHoje.map((d: any, i: number) => (
                  <div key={d.id} className="flex items-center justify-between" style={{ padding: '10px 24px', borderBottom: i < altasHoje.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <p className="text-sm font-medium text-slate-800 truncate">{d.nome}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${estadoCor[d.estado]?.badge ?? 'bg-slate-100 text-slate-600'}`}>{estadoLabel[d.estado] ?? d.estado}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContainer>
        </div>
      </div>
    </>
  );
}

// ─── Vista 6: Reabilitação ────────────────────────────────────────────────────

function DashboardReabilitacao({ utilizador }: { utilizador: any }) {
  const [sessoes, setSessoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isFisio = ['fisioterapeuta', 'reabilitacao_fisica'].includes(utilizador.subRole ?? utilizador.role);

  useEffect(() => {
    if (!isFisio) { setLoading(false); return; }
    api.get('/fisioterapia/agenda').catch(() => ({ data: [] }))
      .then((r) => setSessoes((r.data ?? []).filter((s: any) => new Date(s.data).toDateString() === new Date().toDateString())))
      .finally(() => setLoading(false));
  }, [isFisio]);

  const realizadas = sessoes.filter((s: any) => s.estado === 'realizada');
  const agendadas = sessoes.filter((s: any) => s.estado === 'agendada');

  if (loading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-3 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Sessões Hoje" value={sessoes.length} color="bg-lime-600" />
        <StatCard label="Realizadas" value={realizadas.length} color="bg-emerald-500" />
        <StatCard label="Agendadas" value={agendadas.length} color="bg-blue-500" />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <CardContainer>
          <CardHeader title="Agenda de Hoje" count={sessoes.length} />
          {sessoes.length === 0 ? <Vazio msg="Sem sessões para hoje" /> : (
            <div>
              {sessoes.map((s: any, i: number) => (
                <div key={s.id} className="flex items-center justify-between" style={{ padding: '12px 24px', borderBottom: i < sessoes.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.doente?.nome ?? '—'}</p>
                    <p className="text-xs text-slate-400">{new Date(s.data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · {s.duracao}min · {s.descricao}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.estado === 'realizada' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {s.estado === 'realizada' ? 'Realizada' : 'Agendada'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContainer>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <EmBreve titulo="Avaliações Funcionais" descricao="Barthel, FIM, MRC, FOIS, NRS-2002, PHQ-9..." />
          <EmBreve titulo="Objetivos SMART" descricao="Defina e acompanhe objetivos de reabilitação por doente" />
        </div>
      </div>
    </>
  );
}

// ─── Vista 7: Farmácia ────────────────────────────────────────────────────────

function DashboardFarmacia({ utilizador }: { utilizador: any }) {
  const [alertas, setAlertas] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/farmacia/alertas').catch(() => ({ data: [] })),
      api.get('/farmacia/pedidos').catch(() => ({ data: [] })),
    ]).then(([a, p]) => {
      setAlertas(a.data ?? []);
      setPedidos((p.data ?? []).filter((x: any) => x.estado === 'pendente'));
    }).finally(() => setLoading(false));
  }, []);

  const stockMinimo = alertas.filter((a: any) => a.tipo === 'stock_minimo' || a.quantidade <= a.quantidadeMinima);
  const aExpirar = alertas.filter((a: any) => a.tipo === 'validade' || (a.validade && new Date(a.validade) < new Date(Date.now() + 30 * 86400000)));

  if (loading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-3 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Alertas de Stock" value={stockMinimo.length} color={stockMinimo.length > 0 ? 'bg-red-500' : 'bg-emerald-500'} />
        <StatCard label="Pedidos Pendentes" value={pedidos.length} color={pedidos.length > 0 ? 'bg-amber-500' : 'bg-slate-400'} />
        <StatCard label="A Expirar (30 dias)" value={aExpirar.length} color={aExpirar.length > 0 ? 'bg-orange-500' : 'bg-emerald-500'} />
      </div>

      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>
        <CardContainer>
          <CardHeader title="Alertas de Stock Mínimo" count={stockMinimo.length} countColor={stockMinimo.length > 0 ? 'bg-red-100 text-red-700' : undefined} />
          {stockMinimo.length === 0 ? <Vazio msg="Sem alertas de stock" /> : (
            <div>
              {stockMinimo.slice(0, 6).map((a: any, i: number) => (
                <div key={a.id ?? i} className="flex items-center justify-between" style={{ padding: '10px 24px', borderBottom: i < stockMinimo.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.nome}</p>
                    <p className="text-xs text-slate-400">{a.quantidade} {a.unidade} · mín: {a.quantidadeMinima}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 shrink-0">Baixo</span>
                </div>
              ))}
            </div>
          )}
        </CardContainer>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <CardContainer>
            <CardHeader title="Pedidos de Reposição Pendentes" count={pedidos.length} countColor={pedidos.length > 0 ? 'bg-amber-100 text-amber-700' : undefined} />
            {pedidos.length === 0 ? <Vazio msg="Sem pedidos pendentes" /> : (
              <div>
                {pedidos.slice(0, 4).map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center justify-between" style={{ padding: '10px 24px', borderBottom: i < pedidos.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <p className="text-sm text-slate-700 truncate">{p.stockItem?.nome ?? '—'} × {p.quantidade}</p>
                    <span className="text-xs text-slate-400 shrink-0 ml-2">{p.servico}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContainer>
          <EmBreve titulo="Validação de Prescrições" descricao="Validar prescrições médicas antes da dispensa" />
        </div>
      </div>
    </>
  );
}

// ─── Vista 8: Receção / Secretariado ─────────────────────────────────────────

function DashboardRececao({ utilizador }: { utilizador: any }) {
  const [consultas, setConsultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/consultas').catch(() => ({ data: [] }))
      .then((r) => {
        const hoje = new Date().toDateString();
        setConsultas((r.data ?? []).filter((c: any) => new Date(c.dataHora).toDateString() === hoje));
      })
      .finally(() => setLoading(false));
  }, []);

  const realizadas = consultas.filter((c: any) => c.estado === 'realizada');
  const faltaram = consultas.filter((c: any) => c.estado === 'faltou');
  const agendadas = consultas.filter((c: any) => c.estado === 'agendada');

  const estadoConsulta: Record<string, { badge: string; label: string }> = {
    agendada: { badge: 'bg-blue-100 text-blue-700', label: 'Agendada' },
    realizada: { badge: 'bg-emerald-100 text-emerald-700', label: 'Realizada' },
    faltou: { badge: 'bg-red-100 text-red-700', label: 'Faltou' },
    cancelada: { badge: 'bg-slate-100 text-slate-600', label: 'Cancelada' },
  };

  if (loading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-4 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Consultas Hoje" value={consultas.length} color="bg-pink-600" />
        <StatCard label="Realizadas" value={realizadas.length} color="bg-emerald-500" />
        <StatCard label="Agendadas" value={agendadas.length} color="bg-blue-500" />
        <StatCard label="Faltaram" value={faltaram.length} color={faltaram.length > 0 ? 'bg-red-500' : 'bg-slate-400'} />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <CardContainer>
          <CardHeader title="Consultas de Hoje" count={consultas.length} />
          {consultas.length === 0 ? <Vazio msg="Sem consultas para hoje" /> : (
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {consultas.sort((a: any, b: any) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()).map((c: any, i: number) => (
                <div key={c.id} className="flex items-center justify-between" style={{ padding: '12px 24px', borderBottom: i < consultas.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.nomeDoente ?? c.doente?.nome ?? 'Doente'}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(c.dataHora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · {c.especialidade} · {c.medico?.nome?.split(' ')[0] ?? 'Médico'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${estadoConsulta[c.estado]?.badge ?? 'bg-slate-100 text-slate-600'}`}>
                    {estadoConsulta[c.estado]?.label ?? c.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContainer>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <EmBreve titulo="Sala de Espera em Tempo Real" descricao="Check-in de doentes, tempo de espera, chamada — Fase 7" />
          <EmBreve titulo="Confirmação Automática" descricao="Envio de lembretes de consulta por SMS/email" />
        </div>
      </div>
    </>
  );
}

// ─── Vista 9: Transporte ──────────────────────────────────────────────────────

function DashboardTransporte({ utilizador }: { utilizador: any }) {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/pedidos-internos').catch(() => ({ data: [] }))
      .then((r) => setPedidos((r.data ?? []).filter((p: any) => p.tipo === 'transporte')))
      .finally(() => setLoading(false));
  }, []);

  const pendentes = pedidos.filter((p: any) => p.estado === 'pendente');
  const emCurso = pedidos.filter((p: any) => p.estado === 'em_curso');
  const concluidosHoje = pedidos.filter((p: any) => p.estado === 'concluido' && new Date(p.concluidoEm ?? p.criadoEm).toDateString() === new Date().toDateString());

  const prioridadeCirurgia: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
  const pendentesOrdenados = [...pendentes].sort((a, b) => (prioridadeCirurgia[a.prioridade] ?? 3) - (prioridadeCirurgia[b.prioridade] ?? 3));

  if (loading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-3 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Pedidos Pendentes" value={pendentes.length} color={pendentes.length > 0 ? 'bg-amber-500' : 'bg-slate-400'} />
        <StatCard label="Em Curso" value={emCurso.length} color={emCurso.length > 0 ? 'bg-blue-600' : 'bg-slate-400'} />
        <StatCard label="Concluídos Hoje" value={concluidosHoje.length} color="bg-emerald-500" />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <CardContainer>
          <CardHeader title="Pedidos de Transporte Pendentes" count={pendentes.length} countColor={pendentes.length > 0 ? 'bg-amber-100 text-amber-700' : undefined} />
          {pendentesOrdenados.length === 0 ? <Vazio msg="Sem pedidos pendentes" /> : (
            <div>
              {pendentesOrdenados.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center justify-between" style={{ padding: '12px 24px', borderBottom: i < pendentesOrdenados.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div>
                    <p className="text-sm font-medium text-slate-800 truncate">{p.descricao}</p>
                    <p className="text-xs text-slate-400">{p.localOrigem ?? '—'} → {p.localDestino ?? '—'}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${prioridadeCor[p.prioridade] ?? 'bg-slate-100 text-slate-600'}`}>{p.prioridade}</span>
                </div>
              ))}
            </div>
          )}
        </CardContainer>

        <CardContainer>
          <CardHeader title="Em Curso" count={emCurso.length} countColor={emCurso.length > 0 ? 'bg-blue-100 text-blue-700' : undefined} />
          {emCurso.length === 0 ? <Vazio msg="Nenhum transporte em curso" /> : (
            <div>
              {emCurso.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center justify-between" style={{ padding: '12px 24px', borderBottom: i < emCurso.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.descricao}</p>
                    <p className="text-xs text-slate-400">{p.localOrigem ?? '—'} → {p.localDestino ?? '—'}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">Em curso</span>
                </div>
              ))}
            </div>
          )}
        </CardContainer>
      </div>
    </>
  );
}

// ─── Vista 10: TI ─────────────────────────────────────────────────────────────

function DashboardTI({ utilizador }: { utilizador: any }) {
  const [utilizadores, setUtilizadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/utilizadores').catch(() => ({ data: [] }))
      .then((r) => setUtilizadores(r.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-3 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Utilizadores Ativos" value={utilizadores.filter((u: any) => u.ativo).length} color="bg-cyan-600" />
        <StatCard label="Sessões Abertas" value="—" color="bg-slate-400" sub="Disponível em breve" />
        <StatCard label="Alertas de Segurança" value={0} color="bg-emerald-500" />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <CardContainer>
          <CardHeader title="Utilizadores Ativos por Role" count={utilizadores.filter((u: any) => u.ativo).length} />
          {utilizadores.length === 0 ? <Vazio /> : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {Object.entries(
                utilizadores.filter((u: any) => u.ativo).reduce<Record<string, number>>((acc, u: any) => {
                  acc[roleLabel[u.role] ?? u.role] = (acc[roleLabel[u.role] ?? u.role] ?? 0) + 1;
                  return acc;
                }, {})
              ).sort(([, a], [, b]) => b - a).map(([role, count], i) => (
                <div key={role} className="flex items-center justify-between" style={{ padding: '10px 24px', borderBottom: '1px solid #f8fafc' }}>
                  <p className="text-sm text-slate-700">{role}</p>
                  <span className="text-sm font-semibold text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContainer>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <EmBreve titulo="Logs de Auditoria e Segurança" descricao="Acessos, alterações, eventos de segurança em tempo real" />
          <EmBreve titulo="Monitorização do Sistema" descricao="Estado de serviços, base de dados, latência da API" />
          <EmBreve titulo="Gestão de Sessões Ativas" descricao="Ver e revogar sessões JWT ativas" />
        </div>
      </div>
    </>
  );
}

// ─── Vista 11: Qualidade / Compliance ────────────────────────────────────────

function DashboardQualidade({ utilizador }: { utilizador: any }) {
  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-3 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Não Conformidades" value="—" color="bg-slate-400" sub="Em breve" />
        <StatCard label="Auditorias Pendentes" value="—" color="bg-slate-400" sub="Em breve" />
        <StatCard label="IACS Ativos" value="—" color="bg-slate-400" sub="Em breve" />
      </div>

      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>
        <EmBreve titulo="Gestão de Não Conformidades" descricao="Registo, análise e planos de ação corretiva (CAPA)" />
        <EmBreve titulo="Controlo de Infeção (IACS)" descricao="Doentes em isolamento, alertas de surto, relatórios epidemiológicos" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <EmBreve titulo="Indicadores de Qualidade" descricao="KPIs: taxa de infeção, quedas, úlceras por pressão, reinternamentos" />
        <EmBreve titulo="Auditorias Internas" descricao="Planeamento e seguimento de auditorias por área" />
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl" style={{ padding: '24px', marginTop: '24px' }}>
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-indigo-500 shrink-0" style={{ marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-indigo-800">Módulo de Qualidade em desenvolvimento</p>
            <p className="text-sm text-indigo-600" style={{ marginTop: '4px' }}>
              Não conformidades, controlo de infeção e indicadores de qualidade estarão disponíveis na próxima fase de desenvolvimento.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Vista 12: Executivo ──────────────────────────────────────────────────────

function DashboardExecutivo({ utilizador }: { utilizador: any }) {
  const [ocupacao, setOcupacao] = useState<any>(null);
  const [doentes, setDoentes] = useState<any[]>([]);
  const [urgencia, setUrgencia] = useState<any>(null);
  const [cirurgias, setCirurgias] = useState<any[]>([]);
  const [consultas, setConsultas] = useState<any[]>([]);
  const [alertasFarmacia, setAlertasFarmacia] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/camas/ocupacao').catch(() => ({ data: null })),
      api.get('/doentes?todos=true').catch(() => ({ data: [] })),
      api.get('/urgencia/dashboard').catch(() => ({ data: null })),
      api.get(`/bloco/agenda?data=${hojeISO}`).catch(() => ({ data: [] })),
      api.get('/consultas').catch(() => ({ data: [] })),
      api.get('/farmacia/alertas').catch(() => ({ data: [] })),
      api.get('/dashboard/analytics').catch(() => ({ data: null })),
    ]).then(([o, d, u, c, co, fa, a]) => {
      setOcupacao(o.data);
      setDoentes(d.data ?? []);
      setUrgencia(u.data);
      setCirurgias(c.data ?? []);
      const hoje = new Date().toDateString();
      setConsultas((co.data ?? []).filter((x: any) => new Date(x.dataHora).toDateString() === hoje));
      setAlertasFarmacia(fa.data ?? []);
      setAnalytics(a.data);
    }).finally(() => setLoading(false));
  }, []);

  const pct = ocupacao?.total ? Math.round((ocupacao.ocupadas / ocupacao.total) * 100) : 0;
  const altasHoje = doentes.filter((d: any) => d.dataAltaPrevista && new Date(d.dataAltaPrevista).toDateString() === new Date().toDateString());

  if (loading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-4 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Ocupação de Camas" value={`${pct}%`} sub={`${ocupacao?.ocupadas ?? 0} de ${ocupacao?.total ?? 0} camas`} color={pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500'} />
        <StatCard label="Doentes Internados" value={doentes.length} color="bg-slate-700" />
        <StatCard label="Cirurgias Hoje" value={cirurgias.length} color="bg-red-600" sub={`${cirurgias.filter((c: any) => c.estado === 'concluida').length} concluídas`} />
        <StatCard label="Consultas Hoje" value={consultas.length} color="bg-blue-600" sub={`${consultas.filter((c: any) => c.estado === 'realizada').length} realizadas`} />
      </div>

      <div className="grid grid-cols-3 gap-5" style={{ marginBottom: '24px' }}>

        {/* Resumo de doentes */}
        <div className="rounded-2xl shadow-lg flex flex-col justify-between" style={{ padding: '28px', background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}>
          <div>
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest" style={{ marginBottom: '16px' }}>Doentes por Estado</p>
            <p className="text-5xl font-bold text-white" style={{ marginBottom: '4px' }}>{doentes.length}</p>
            <p className="text-blue-200 text-sm">doentes internados</p>
          </div>
          <div style={{ marginTop: '24px' }} className="space-y-2">
            {(['estavel', 'grave', 'critico', 'alta_prevista'] as const).map((e) => (
              <div key={e} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${estadoCor[e].dot}`} />
                  <span className="text-blue-100">{estadoLabel[e]}</span>
                </div>
                <span className="font-semibold text-white">{doentes.filter((d) => d.estado === e).length}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Urgência */}
        <CardContainer>
          <CardHeader title="Urgência — Últimas 24h" />
          <div style={{ padding: '20px 24px' }}>
            {urgencia ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Total de episódios</span>
                  <span className="font-bold text-slate-900">{urgencia.total ?? '—'}</span>
                </div>
                {urgencia.porTriagem && Object.entries(urgencia.porTriagem).map(([cor, n]: [string, any]) => (
                  <div key={cor} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${cor === 'vermelho' ? 'bg-red-500' : cor === 'laranja' ? 'bg-orange-500' : cor === 'amarelo' ? 'bg-yellow-400' : cor === 'verde' ? 'bg-emerald-500' : 'bg-blue-400'}`} />
                      <span className="text-sm text-slate-600 capitalize">{cor}</span>
                    </div>
                    <span className="font-semibold text-slate-900">{n}</span>
                  </div>
                ))}
              </div>
            ) : <Vazio msg="Sem dados de urgência" />}
          </div>
        </CardContainer>

        {/* Farmácia + Altas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <CardContainer>
            <CardHeader title="Alertas Farmácia" count={alertasFarmacia.length} countColor={alertasFarmacia.length > 0 ? 'bg-orange-100 text-orange-700' : undefined} />
            <div style={{ padding: '14px 24px' }}>
              <p className="text-sm text-slate-500">{alertasFarmacia.length > 0 ? `${alertasFarmacia.length} items abaixo do stock mínimo ou a expirar` : 'Stock em níveis adequados'}</p>
            </div>
          </CardContainer>
          <CardContainer>
            <CardHeader title="Altas Previstas Hoje" count={altasHoje.length} countColor={altasHoje.length > 0 ? 'bg-blue-100 text-blue-700' : undefined} />
            <div style={{ padding: '14px 24px' }}>
              <p className="text-sm text-slate-500">{altasHoje.length > 0 ? `${altasHoje.length} doentes com alta prevista para hoje` : 'Sem altas previstas para hoje'}</p>
            </div>
          </CardContainer>
        </div>
      </div>

      {/* Tendência de ocupação */}
      {analytics?.ocupacaoDiaria && (
        <CardContainer>
          <CardHeader title="Tendência de Ocupação — Últimas 2 semanas" />
          <div style={{ padding: '20px 24px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={analytics.ocupacaoDiaria} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradExec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => new Date(v).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip labelFormatter={(l) => new Date(l).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' })} formatter={(v, name) => [v, name === 'ocupadas' ? 'Ocupadas' : 'Total']} />
                <Area type="monotone" dataKey="total" stroke="#e2e8f0" fill="none" strokeDasharray="4 2" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="ocupadas" stroke="#2563eb" fill="url(#gradExec)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContainer>
      )}
    </>
  );
}

// ─── Vista fallback: Genérico ─────────────────────────────────────────────────

function DashboardGenerico({ utilizador }: { utilizador: any }) {
  const [ocupacao, setOcupacao] = useState<any>(null);
  const [doentes, setDoentes] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const ROLES_ANALYTICS = ['administrativo', 'chefe_enfermeiros', 'chefe_turno', 'chefe_medicos', 'assistente_administrativo'];

  useEffect(() => {
    Promise.all([
      api.get('/camas/ocupacao').catch(() => ({ data: null })),
      api.get('/doentes?todos=true').catch(() => ({ data: [] })),
    ]).then(([o, d]) => { setOcupacao(o.data); setDoentes(d.data ?? []); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!utilizador || !ROLES_ANALYTICS.includes(utilizador.role)) return;
    api.get('/dashboard/analytics').then((r) => setAnalytics(r.data)).catch(() => {});
  }, [utilizador]);

  const criticos = doentes.filter((d: any) => d.estado === 'critico');
  const altasHoje = doentes.filter((d: any) => d.dataAltaPrevista && new Date(d.dataAltaPrevista).toDateString() === new Date().toDateString());

  if (loading) return <Spinner />;

  const ocupacaoMap: Record<string, number> = { total: ocupacao?.total ?? 0, ocupadas: ocupacao?.ocupadas ?? 0, livres: ocupacao?.livres ?? 0, emLimpeza: ocupacao?.emLimpeza ?? 0 };
  const statCards = [
    { key: 'total', label: 'Total de Camas', color: 'bg-slate-800' },
    { key: 'ocupadas', label: 'Camas Ocupadas', color: 'bg-red-500' },
    { key: 'livres', label: 'Camas Livres', color: 'bg-emerald-500' },
    { key: 'emLimpeza', label: 'Em Limpeza', color: 'bg-amber-500' },
  ];

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-4 gap-5" style={{ marginBottom: '32px' }}>
        {statCards.map(({ key, label, color }) => (
          <StatCard key={key} label={label} value={ocupacaoMap[key]} color={color} sub={key === 'ocupadas' && ocupacao?.total ? `${Math.round((ocupacao.ocupadas / ocupacao.total) * 100)}% de ocupação` : undefined} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5" style={{ marginBottom: '32px' }}>
        <CardContainer>
          <CardHeader title="Doentes Críticos" count={criticos.length} countColor={criticos.length > 0 ? 'bg-red-100 text-red-700' : undefined} />
          {criticos.length === 0 ? (
            <div className="flex flex-col items-center justify-center" style={{ padding: '36px 24px' }}>
              <svg className="w-8 h-8 text-emerald-400" style={{ marginBottom: '10px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <p className="text-slate-400 text-sm">Sem doentes críticos</p>
            </div>
          ) : criticos.map((d: any, i: number) => (
            <div key={d.id} className="flex items-center justify-between" style={{ padding: '12px 24px', borderBottom: i < criticos.length - 1 ? '1px solid #f8fafc' : 'none' }}>
              <div className="min-w-0">
                <p className="font-medium text-slate-800 text-sm truncate">{d.nome}</p>
                <p className="text-slate-400 text-xs">Cama {d.cama?.numero}</p>
              </div>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${estadoCor[d.estado]?.badge}`}>{estadoLabel[d.estado]}</span>
            </div>
          ))}
        </CardContainer>

        <CardContainer>
          <CardHeader title="Altas Previstas Hoje" count={altasHoje.length} countColor={altasHoje.length > 0 ? 'bg-blue-100 text-blue-700' : undefined} />
          {altasHoje.length === 0 ? <Vazio msg="Sem altas previstas para hoje" /> : altasHoje.map((d: any, i: number) => (
            <div key={d.id} className="flex items-center justify-between" style={{ padding: '12px 24px', borderBottom: i < altasHoje.length - 1 ? '1px solid #f8fafc' : 'none' }}>
              <div className="min-w-0">
                <p className="font-medium text-slate-800 text-sm truncate">{d.nome}</p>
                <p className="text-slate-400 text-xs truncate">{d.diagnosticoPrincipal}</p>
              </div>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${estadoCor[d.estado]?.badge}`}>{estadoLabel[d.estado]}</span>
            </div>
          ))}
        </CardContainer>

        <div className="rounded-2xl shadow-lg flex flex-col justify-between" style={{ padding: '28px', background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}>
          <div>
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest" style={{ marginBottom: '16px' }}>Resumo Global</p>
            <p className="text-5xl font-bold text-white" style={{ marginBottom: '4px' }}>{doentes.length}</p>
            <p className="text-blue-200 text-sm">doentes internados</p>
          </div>
          <div style={{ marginTop: '24px' }} className="space-y-2">
            {(['estavel', 'grave', 'critico', 'alta_prevista'] as const).map((e) => (
              <div key={e} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${estadoCor[e].dot}`} /><span className="text-blue-100">{estadoLabel[e]}</span></div>
                <span className="font-semibold text-white">{doentes.filter((d) => d.estado === e).length}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {analytics && (
        <div style={{ marginBottom: '32px' }}>
          <SecaoTitulo>Análises e Métricas</SecaoTitulo>
          <div className="grid grid-cols-2 gap-5">
            <CardContainer>
              <CardHeader title="Ocupação — Últimas 2 semanas" />
              <div style={{ padding: '16px 24px' }}>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={analytics.ocupacaoDiaria} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs><linearGradient id="gradG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => new Date(v).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip formatter={(v, n) => [v, n === 'ocupadas' ? 'Ocupadas' : 'Total']} labelFormatter={(l) => new Date(l).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' })} />
                    <Area type="monotone" dataKey="total" stroke="#e2e8f0" fill="none" strokeDasharray="4 2" strokeWidth={1.5} dot={false} />
                    <Area type="monotone" dataKey="ocupadas" stroke="#2563eb" fill="url(#gradG)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContainer>
            <CardContainer>
              <CardHeader title="Carga por Enfermeiro — Turno Atual" />
              <div style={{ padding: '16px 24px' }}>
                {analytics.cargaEnfermeiros?.length === 0 ? <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Sem atribuições no turno atual</div> : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={analytics.cargaEnfermeiros} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                      <YAxis type="category" dataKey="nome" width={90} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: string) => v.split(' ')[0]} />
                      <Tooltip formatter={(v, n) => [v, n === 'numDoentes' ? 'Doentes' : 'Tarefas']} />
                      <Bar dataKey="numDoentes" fill="#2563eb" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="tarefasPendentes" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContainer>
          </div>
        </div>
      )}

      <CardContainer>
        <CardHeader title="Todos os Doentes Internados" count={doentes.length} />
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              {['Doente', 'Cama', 'Diagnóstico', 'Estado', 'Alta Prevista'].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ padding: '12px 24px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doentes.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-slate-400 text-sm" style={{ padding: '48px' }}>Sem doentes internados</td></tr>
            ) : doentes.map((d: any, i: number) => (
              <tr key={d.id} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: i < doentes.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                <td style={{ padding: '14px 24px' }}><div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full shrink-0 ${estadoCor[d.estado]?.dot ?? 'bg-slate-300'}`} /><span className="font-medium text-slate-900">{d.nome}</span></div></td>
                <td className="text-slate-500" style={{ padding: '14px 24px' }}>Q{d.cama?.quarto} / {d.cama?.numero}</td>
                <td className="text-slate-500 max-w-xs truncate" style={{ padding: '14px 24px' }}>{d.diagnosticoPrincipal}</td>
                <td style={{ padding: '14px 24px' }}><span className={`text-xs font-medium rounded-lg ${estadoCor[d.estado]?.badge}`} style={{ padding: '4px 10px' }}>{estadoLabel[d.estado] ?? d.estado}</span></td>
                <td className="text-slate-500" style={{ padding: '14px 24px' }}>{d.dataAltaPrevista ? new Date(d.dataAltaPrevista).toLocaleDateString('pt-PT') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContainer>
    </>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center gap-3 text-slate-400" style={{ paddingTop: '80px' }}>
      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-sm">A carregar dados...</span>
    </div>
  );
}

// ─── Router principal ─────────────────────────────────────────────────────────

const ROLES_MEDICO = ['cardiologista','urologista','ortopedista','neurologista','ginecologista','pediatra','oncologista','clinico_geral','medico','medico_especialista'];
const ROLES_BLOCO = ['cirurgiao_geral','medico_anestesia','cirurgiao','anestesiologista','anestesista'];
const ROLES_IMAG = ['medico_imagem','anatomia_patologica','tecnico_radiologia','tecnico_tac_rm','tecnico_analises_clinicas','tecnico_cardiopneumologia','radiologista','patologista'];
const ROLES_ENF = ['generalista','enf_uci','enf_bloco','enf_obstetricia','enf_pediatria','enfermeiro','enfermeiro_especialista'];
const ROLES_CHEFE_ENF = ['supervisor_enfermagem','chefe_turno','chefe_enfermeiros','enfermeiro_gestor','chefe_medicos'];
const ROLES_REAB = ['reabilitacao_fisica','reabilitacao_fala','nutricao_clinica','psicologia_clinica','fisioterapeuta','terapeuta_fala','nutricionista','psicologo'];
const ROLES_FARM = ['farmaceutico_hospitalar','farmaceutico_oncologico','tecnico_farmacia_assist','farmaceutico','farmaceutico_clinico','tecnico_farmacia'];
const ROLES_RECEC = ['front_desk','secretariado','scheduling','rececionista','secretario_clinico','gestor_agendamento','secretaria'];
const ROLES_TRANSP = ['transporte_interno','maqueiro'];
const ROLES_TI = ['sysadmin','database_admin','security_officer','it_admin','analista_sistemas','dba','ciberseguranca','bi_analyst','cio'];
const ROLES_QUAL = ['quality_manager','compliance','infection_control','internal_audit','dpo_role','gestor_qualidade','compliance_officer','controlo_infecao','auditor_interno','dpo'];
const ROLES_EXEC = ['ceo_hospitalar','cfo','coo','hr_director','compliance_director','diretor_medico','head_nurse',
  'diretor_geral','diretor_clinico','diretor_financeiro','diretor_operacional','diretor_rh','diretor_ti','diretor_qualidade','diretor_enfermagem'];

export default function DashboardPage() {
  const { utilizador, loading } = useAuth();

  if (loading || !utilizador) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner />
    </div>
  );

  const sr = utilizador.subRole ?? utilizador.role;
  const props = { utilizador };

  const renderVista = () => {
    if (ROLES_MEDICO.includes(sr))     return <DashboardMedico {...props} />;
    if (ROLES_BLOCO.includes(sr))      return <DashboardBloco {...props} />;
    if (ROLES_IMAG.includes(sr))       return <DashboardImagiologia {...props} />;
    if (ROLES_ENF.includes(sr))        return <DashboardEnfermeiro {...props} />;
    if (ROLES_CHEFE_ENF.includes(sr))  return <DashboardChefeEnfermagem {...props} />;
    if (ROLES_REAB.includes(sr))       return <DashboardReabilitacao {...props} />;
    if (ROLES_FARM.includes(sr))       return <DashboardFarmacia {...props} />;
    if (ROLES_RECEC.includes(sr))      return <DashboardRececao {...props} />;
    if (ROLES_TRANSP.includes(sr))     return <DashboardTransporte {...props} />;
    if (ROLES_TI.includes(sr))         return <DashboardTI {...props} />;
    if (ROLES_QUAL.includes(sr))       return <DashboardQualidade {...props} />;
    if (ROLES_EXEC.includes(sr))       return <DashboardExecutivo {...props} />;
    return <DashboardGenerico {...props} />;
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>
      {renderVista()}
    </div>
  );
}
