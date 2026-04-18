'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';

interface Utilizador {
  id: string;
  nome: string;
  numeroFuncionario: string;
  role: string;
  subRole?: string;
  servico: string;
  ordemExperiencia?: number;
  equipa?: string;
  ativo: boolean;
}

const roleLabel: Record<string, string> = {
  diretor_geral: 'Diretor Geral', diretor_clinico: 'Diretor Clínico',
  diretor_enfermagem: 'Diretor de Enfermagem', diretor_financeiro: 'Diretor Financeiro',
  diretor_operacional: 'Diretor Operacional', diretor_rh: 'Diretor de RH',
  diretor_ti: 'Diretor de TI', diretor_qualidade: 'Diretor de Qualidade',
  medico: 'Médico', medico_especialista: 'Médico Especialista',
  cirurgiao: 'Cirurgião', anestesiologista: 'Anestesiologista',
  radiologista: 'Radiologista', patologista: 'Patologista',
  enfermeiro: 'Enfermeiro', enfermeiro_especialista: 'Enfermeiro Especialista',
  enfermeiro_gestor: 'Enfermeiro Gestor',
  auxiliar_saude: 'Auxiliar de Saúde', tecnico: 'Técnico',
  fisioterapeuta: 'Fisioterapeuta', terapeuta_fala: 'Terapeuta da Fala',
  nutricionista: 'Nutricionista', psicologo: 'Psicólogo',
  farmaceutico: 'Farmacêutico', farmaceutico_clinico: 'Farmacêutico Clínico',
  tecnico_farmacia: 'Técnico de Farmácia',
  rececionista: 'Rececionista', secretario_clinico: 'Secretário Clínico',
  assistente_administrativo: 'Assistente Administrativo', gestor_agendamento: 'Gestor de Agendamento',
  faturacao: 'Faturação', rh: 'RH', compras: 'Compras',
  maqueiro: 'Maqueiro', assistente_operacional: 'Assistente Operacional',
  esterilizacao: 'Esterilização', limpeza: 'Limpeza', lavandaria: 'Lavandaria',
  engenheiro_biomedico: 'Engenheiro Biomédico', tecnico_manutencao: 'Técnico de Manutenção',
  seguranca: 'Segurança', sst: 'SST', it_admin: 'IT Admin',
  analista_sistemas: 'Analista de Sistemas', dba: 'DBA',
  ciberseguranca: 'Cibersegurança', bi_analyst: 'BI Analyst', dpo: 'DPO',
  gestor_qualidade: 'Gestor de Qualidade', compliance_officer: 'Compliance Officer',
  controlo_infecao: 'Controlo de Infeção', auditor_interno: 'Auditor Interno',
  // Legado
  auxiliar: 'Auxiliar', administrativo: 'Administrativo',
  chefe_turno: 'Chefe de Turno', chefe_enfermeiros: 'Chefe de Enfermeiros',
  chefe_medicos: 'Chefe de Médicos', triador: 'Triador',
  anestesista: 'Anestesista', instrumentista: 'Instrumentista', secretaria: 'Secretária',
};

const subRoleLabel: Record<string, string> = {
  ceo_hospitalar: 'CEO Hospitalar', diretor_medico: 'Diretor Médico', head_nurse: 'Head Nurse',
  cfo: 'CFO', coo: 'COO', hr_director: 'HR Director', cio: 'CIO', compliance_director: 'Compliance Director',
  clinico_geral: 'Clínico Geral',
  cardiologista: 'Cardiologista', urologista: 'Urologista', ortopedista: 'Ortopedista',
  neurologista: 'Neurologista', ginecologista: 'Ginecologista', pediatra: 'Pediatra', oncologista: 'Oncologista',
  cirurgiao_geral: 'Cirurgião Geral', medico_anestesia: 'Médico Anestesia',
  medico_imagem: 'Médico Imagem', anatomia_patologica: 'Anatomia Patológica',
  generalista: 'Generalista',
  enf_uci: 'UCI', enf_bloco: 'Bloco Operatório', enf_obstetricia: 'Obstetrícia', enf_pediatria: 'Pediatria',
  supervisor_enfermagem: 'Supervisor',
  tae: 'TAE',
  tecnico_radiologia: 'Radiologia', tecnico_tac_rm: 'TAC/RM',
  tecnico_analises_clinicas: 'Análises Clínicas', tecnico_cardiopneumologia: 'Cardiopneumologia',
  reabilitacao_fisica: 'Reabilitação Física', reabilitacao_fala: 'Reabilitação Fala',
  nutricao_clinica: 'Nutrição Clínica', psicologia_clinica: 'Psicologia Clínica',
  farmaceutico_hospitalar: 'Hospitalar', farmaceutico_oncologico: 'Oncológico', tecnico_farmacia_assist: 'Assistente',
  front_desk: 'Front Desk', secretariado: 'Secretariado', backoffice: 'Backoffice',
  scheduling: 'Scheduling', billing_officer: 'Billing Officer', hr_specialist: 'HR Specialist', procurement: 'Procurement',
  transporte_interno: 'Transporte Interno', apoio_geral: 'Apoio Geral', cssd: 'CSSD',
  higiene_hospitalar: 'Higiene Hospitalar', gestao_textil: 'Gestão Têxtil',
  equipamentos_medicos: 'Equipamentos Médicos', facilities: 'Facilities',
  vigilancia: 'Vigilância', seguranca_trabalho: 'Segurança Trabalho',
  sysadmin: 'SysAdmin', his_erp: 'HIS/ERP', database_admin: 'Database Admin',
  security_officer: 'Security Officer', dados_clinicos: 'Dados Clínicos',
  dpo_role: 'DPO', quality_manager: 'Quality Manager', compliance: 'Compliance',
  infection_control: 'Infection Control', internal_audit: 'Internal Audit',
};

const SUBROLES_POR_ROLE: Record<string, string[]> = {
  diretor_geral: ['ceo_hospitalar'], diretor_clinico: ['diretor_medico'],
  diretor_enfermagem: ['head_nurse'], diretor_financeiro: ['cfo'],
  diretor_operacional: ['coo'], diretor_rh: ['hr_director'],
  diretor_ti: ['cio'], diretor_qualidade: ['compliance_director'],
  medico: ['clinico_geral'],
  medico_especialista: ['cardiologista', 'urologista', 'ortopedista', 'neurologista', 'ginecologista', 'pediatra', 'oncologista'],
  cirurgiao: ['cirurgiao_geral'], anestesiologista: ['medico_anestesia'],
  radiologista: ['medico_imagem'], patologista: ['anatomia_patologica'],
  enfermeiro: ['generalista'],
  enfermeiro_especialista: ['enf_uci', 'enf_bloco', 'enf_obstetricia', 'enf_pediatria'],
  enfermeiro_gestor: ['supervisor_enfermagem'],
  auxiliar_saude: ['tae'],
  tecnico: ['tecnico_radiologia', 'tecnico_tac_rm', 'tecnico_analises_clinicas', 'tecnico_cardiopneumologia'],
  fisioterapeuta: ['reabilitacao_fisica'], terapeuta_fala: ['reabilitacao_fala'],
  nutricionista: ['nutricao_clinica'], psicologo: ['psicologia_clinica'],
  farmaceutico: ['farmaceutico_hospitalar'], farmaceutico_clinico: ['farmaceutico_oncologico'],
  tecnico_farmacia: ['tecnico_farmacia_assist'],
  rececionista: ['front_desk'], secretario_clinico: ['secretariado'],
  assistente_administrativo: ['backoffice'], gestor_agendamento: ['scheduling'],
  faturacao: ['billing_officer'], rh: ['hr_specialist'], compras: ['procurement'],
  maqueiro: ['transporte_interno'], assistente_operacional: ['apoio_geral'],
  esterilizacao: ['cssd'], limpeza: ['higiene_hospitalar'], lavandaria: ['gestao_textil'],
  engenheiro_biomedico: ['equipamentos_medicos'], tecnico_manutencao: ['facilities'],
  seguranca: ['vigilancia'], sst: ['seguranca_trabalho'],
  it_admin: ['sysadmin'], analista_sistemas: ['his_erp'], dba: ['database_admin'],
  ciberseguranca: ['security_officer'], bi_analyst: ['dados_clinicos'],
  dpo: ['dpo_role'], gestor_qualidade: ['quality_manager'],
  compliance_officer: ['compliance'], controlo_infecao: ['infection_control'],
  auditor_interno: ['internal_audit'],
};

const servicoLabel: Record<string, string> = {
  internamento: 'Internamento', urgencia: 'Urgência', bloco_operatorio: 'Bloco Operatório',
  consultas_externas: 'Consultas Externas', farmacia: 'Farmácia', fisioterapia: 'Fisioterapia',
  transporte: 'Transporte', administrativo: 'Administrativo',
};

const SERVICOS = Object.keys(servicoLabel);
const ROLES = Object.keys(roleLabel).filter((r) => !['chefe_turno'].includes(r));

const roleCor: Record<string, { badge: string; dot: string }> = {
  diretor_geral: { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  diretor_clinico: { badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  diretor_enfermagem: { badge: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500' },
  diretor_financeiro: { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  diretor_operacional: { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  diretor_rh: { badge: 'bg-pink-100 text-pink-700', dot: 'bg-pink-500' },
  diretor_ti: { badge: 'bg-cyan-100 text-cyan-700', dot: 'bg-cyan-500' },
  diretor_qualidade: { badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  medico: { badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  medico_especialista: { badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  cirurgiao: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  anestesiologista: { badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  radiologista: { badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  patologista: { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  enfermeiro: { badge: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500' },
  enfermeiro_especialista: { badge: 'bg-cyan-100 text-cyan-700', dot: 'bg-cyan-500' },
  enfermeiro_gestor: { badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  auxiliar_saude: { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  tecnico: { badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  fisioterapeuta: { badge: 'bg-lime-100 text-lime-700', dot: 'bg-lime-500' },
  terapeuta_fala: { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  nutricionista: { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  psicologo: { badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  farmaceutico: { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  farmaceutico_clinico: { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  tecnico_farmacia: { badge: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500' },
  rececionista: { badge: 'bg-pink-100 text-pink-700', dot: 'bg-pink-500' },
  secretario_clinico: { badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  assistente_administrativo: { badge: 'bg-pink-100 text-pink-700', dot: 'bg-pink-500' },
  gestor_agendamento: { badge: 'bg-fuchsia-100 text-fuchsia-700', dot: 'bg-fuchsia-500' },
  faturacao: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  rh: { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  compras: { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  maqueiro: { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  assistente_operacional: { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  esterilizacao: { badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  limpeza: { badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  lavandaria: { badge: 'bg-cyan-100 text-cyan-700', dot: 'bg-cyan-500' },
  engenheiro_biomedico: { badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  tecnico_manutencao: { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  seguranca: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  sst: { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  it_admin: { badge: 'bg-cyan-100 text-cyan-700', dot: 'bg-cyan-500' },
  analista_sistemas: { badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  dba: { badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  ciberseguranca: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  bi_analyst: { badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  dpo: { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  gestor_qualidade: { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  compliance_officer: { badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  controlo_infecao: { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  auditor_interno: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  auxiliar: { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  administrativo: { badge: 'bg-pink-100 text-pink-700', dot: 'bg-pink-500' },
  chefe_turno: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  chefe_enfermeiros: { badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  chefe_medicos: { badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  triador: { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  anestesista: { badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  instrumentista: { badge: 'bg-cyan-100 text-cyan-700', dot: 'bg-cyan-500' },
  secretaria: { badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
};

function Avatar({ nome }: { nome: string }) {
  const initials = nome.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}

function SubRoleSelect({ role, value, onChange }: { role: string; value: string; onChange: (v: string) => void }) {
  const opcoes = SUBROLES_POR_ROLE[role] ?? [];
  if (opcoes.length === 0) return null;
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Sub-role / Especialização</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white transition"
        style={{ padding: '10px 14px' }}
      >
        <option value="">Sem sub-role</option>
        {opcoes.map((sr) => <option key={sr} value={sr}>{subRoleLabel[sr] ?? sr}</option>)}
      </select>
    </div>
  );
}

export default function UtilizadoresPagina() {
  const [utilizadores, setUtilizadores] = useState<Utilizador[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ nome: '', numeroFuncionario: '', password: '', role: 'enfermeiro', subRole: '', servico: 'internamento', ordemExperiencia: '' });
  const [erro, setErro] = useState('');

  const [editando, setEditando] = useState<Utilizador | null>(null);
  const [formEdit, setFormEdit] = useState({ nome: '', role: 'enfermeiro', subRole: '', servico: 'internamento', ordemExperiencia: '', equipa: '' });
  const [erroEdit, setErroEdit] = useState('');

  const carregar = async () => {
    const r = await api.get('/utilizadores');
    setUtilizadores(r.data);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    try {
      await api.post('/utilizadores', {
        nome: form.nome,
        numeroFuncionario: form.numeroFuncionario,
        password: form.password,
        role: form.role,
        subRole: form.subRole || undefined,
        servico: form.servico,
        ordemExperiencia: form.ordemExperiencia ? Number(form.ordemExperiencia) : undefined,
      });
      setMostrarForm(false);
      setForm({ nome: '', numeroFuncionario: '', password: '', role: 'enfermeiro', subRole: '', servico: 'internamento', ordemExperiencia: '' });
      await carregar();
    } catch (err: any) {
      setErro(err.response?.data?.message ?? 'Erro ao criar utilizador');
    }
  };

  const desativar = async (id: string) => {
    if (!confirm('Desativar este utilizador?')) return;
    await api.delete(`/utilizadores/${id}`);
    await carregar();
  };

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => {
      const novo = { ...f, [field]: e.target.value };
      if (field === 'role') novo.subRole = '';
      return novo;
    });
  };

  const abrirEditar = (u: Utilizador) => {
    setEditando(u);
    setFormEdit({ nome: u.nome, role: u.role, subRole: u.subRole ?? '', servico: u.servico ?? 'internamento', ordemExperiencia: u.ordemExperiencia?.toString() ?? '', equipa: u.equipa ?? '' });
    setErroEdit('');
  };

  const guardarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    setErroEdit('');
    try {
      await api.patch(`/utilizadores/${editando.id}`, {
        nome: formEdit.nome,
        role: formEdit.role,
        subRole: formEdit.subRole || null,
        servico: formEdit.servico,
        ordemExperiencia: formEdit.ordemExperiencia ? Number(formEdit.ordemExperiencia) : undefined,
        equipa: formEdit.equipa || undefined,
      });
      setEditando(null);
      await carregar();
    } catch (err: any) {
      setErroEdit(err.response?.data?.message ?? 'Erro ao guardar alterações');
    }
  };

  const porRole = ROLES.reduce<Record<string, Utilizador[]>>((acc, role) => {
    acc[role] = utilizadores.filter((u) => u.role === role && u.ativo);
    return acc;
  }, {});

  const rolesComUtilizadores = ROLES.filter((r) => porRole[r].length > 0);
  const equipasExistentes = [...new Set(utilizadores.map((u) => u.equipa).filter(Boolean) as string[])].sort();

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Utilizadores</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>
            {utilizadores.filter((u) => u.ativo).length} profissionais ativos
          </p>
        </div>
        <button
          onClick={() => setMostrarForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          style={{ padding: '10px 20px', fontSize: '14px' }}
        >
          + Novo Utilizador
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 text-slate-400" style={{ paddingTop: '60px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar...</span>
        </div>
      ) : rolesComUtilizadores.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center" style={{ padding: '80px' }}>
          <p className="text-slate-400 text-sm">Sem utilizadores registados</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {rolesComUtilizadores.map((role) => (
            <div key={role} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between" style={{ padding: '18px 24px', borderBottom: '1px solid #f8fafc' }}>
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${roleCor[role]?.dot ?? 'bg-slate-400'}`} />
                  <h2 className="font-semibold text-slate-800">{roleLabel[role] ?? role}</h2>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                  {porRole[role].length}
                </span>
              </div>
              <div>
                {porRole[role].map((u, i) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between hover:bg-slate-50 transition-colors"
                    style={{ padding: '14px 24px', borderBottom: i < porRole[role].length - 1 ? '1px solid #f8fafc' : 'none' }}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar nome={u.nome} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{u.nome}</p>
                        <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: '3px' }}>
                          <span className="text-xs text-slate-400">Nº {u.numeroFuncionario}</span>
                          {u.equipa && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              Equipa {u.equipa}
                            </span>
                          )}
                          {u.ordemExperiencia && (
                            <>
                              <span className="text-slate-200">·</span>
                              <span className="text-xs text-slate-400">#{u.ordemExperiencia} experiência</span>
                            </>
                          )}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleCor[role]?.badge ?? 'bg-slate-100 text-slate-600'}`}>
                            {roleLabel[role] ?? role}
                          </span>
                          {u.subRole && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                              {subRoleLabel[u.subRole] ?? u.subRole}
                            </span>
                          )}
                          {u.servico && u.servico !== 'internamento' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                              {servicoLabel[u.servico] ?? u.servico}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => abrirEditar(u)}
                        className="text-xs font-medium text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        style={{ padding: '6px 12px' }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => desativar(u.id)}
                        className="text-xs font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        style={{ padding: '6px 12px' }}
                      >
                        Desativar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal editar utilizador */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto" style={{ padding: '32px', maxHeight: '90vh' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 className="text-xl font-bold text-slate-900">Editar Utilizador</h2>
              <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>Nº {editando.numeroFuncionario}</p>
            </div>
            <form onSubmit={guardarEdicao}>
              <div style={{ marginBottom: '20px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Nome completo</label>
                <input
                  required
                  value={formEdit.nome}
                  onChange={(e) => setFormEdit((f) => ({ ...f, nome: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  style={{ padding: '10px 14px' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '16px' }}>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Função</label>
                  <select
                    value={formEdit.role}
                    onChange={(e) => setFormEdit((f) => ({ ...f, role: e.target.value, subRole: '' }))}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white transition"
                    style={{ padding: '10px 14px' }}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{roleLabel[r] ?? r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Serviço</label>
                  <select
                    value={formEdit.servico}
                    onChange={(e) => setFormEdit((f) => ({ ...f, servico: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white transition"
                    style={{ padding: '10px 14px' }}
                  >
                    {SERVICOS.map((s) => <option key={s} value={s}>{servicoLabel[s] ?? s}</option>)}
                  </select>
                </div>
              </div>
              {(SUBROLES_POR_ROLE[formEdit.role]?.length ?? 0) > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <SubRoleSelect
                    role={formEdit.role}
                    value={formEdit.subRole}
                    onChange={(v) => setFormEdit((f) => ({ ...f, subRole: v }))}
                  />
                </div>
              )}
              <div style={{ marginBottom: '16px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Ordem Experiência <span className="text-xs text-slate-400 font-normal">(1 = mais experiente)</span></label>
                <input
                  type="number" min="1"
                  value={formEdit.ordemExperiencia}
                  onChange={(e) => setFormEdit((f) => ({ ...f, ordemExperiencia: e.target.value }))}
                  placeholder="Ex: 1"
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
                  style={{ padding: '10px 14px' }}
                />
              </div>
              <div style={{ marginBottom: '28px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Equipa</label>
                {equipasExistentes.length > 0 && (
                  <div className="flex flex-wrap gap-2" style={{ marginBottom: '10px' }}>
                    <button type="button" onClick={() => setFormEdit((f) => ({ ...f, equipa: '' }))}
                      className={`text-xs font-medium rounded-lg border transition-all ${formEdit.equipa === '' ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      style={{ padding: '4px 12px' }}>Sem equipa</button>
                    {equipasExistentes.map((eq) => (
                      <button key={eq} type="button" onClick={() => setFormEdit((f) => ({ ...f, equipa: eq }))}
                        className={`text-xs font-medium rounded-lg border transition-all ${formEdit.equipa === eq ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                        style={{ padding: '4px 12px' }}>Equipa {eq}</button>
                    ))}
                  </div>
                )}
                <input
                  value={formEdit.equipa}
                  onChange={(e) => setFormEdit((f) => ({ ...f, equipa: e.target.value }))}
                  placeholder="Nome da equipa (ex: A, Alfa, Turno 1...)"
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  style={{ padding: '10px 14px' }}
                />
                <p className="text-xs text-slate-400" style={{ marginTop: '6px' }}>Deixe em branco para remover da equipa</p>
              </div>
              {erroEdit && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" style={{ padding: '12px 16px', marginBottom: '20px' }}>
                  {erroEdit}
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditando(null)}
                  className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  style={{ padding: '11px' }}>Cancelar</button>
                <button type="submit"
                  className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                  style={{ padding: '11px' }}>Guardar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal novo utilizador */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto" style={{ padding: '32px', maxHeight: '90vh' }}>
            <h2 className="text-xl font-bold text-slate-900" style={{ marginBottom: '28px' }}>Novo Utilizador</h2>
            <form onSubmit={criar}>
              <div style={{ marginBottom: '20px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Nome completo</label>
                <input
                  required value={form.nome} onChange={setField('nome')}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  style={{ padding: '10px 14px' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '20px' }}>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Nº Funcionário</label>
                  <input required value={form.numeroFuncionario} onChange={setField('numeroFuncionario')}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                    style={{ padding: '10px 14px' }} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Password</label>
                  <input type="password" required value={form.password} onChange={setField('password')}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                    style={{ padding: '10px 14px' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '16px' }}>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Função</label>
                  <select value={form.role} onChange={setField('role')}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition bg-white"
                    style={{ padding: '10px 14px' }}>
                    {ROLES.map((r) => <option key={r} value={r}>{roleLabel[r] ?? r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Serviço</label>
                  <select value={form.servico} onChange={setField('servico')}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition bg-white"
                    style={{ padding: '10px 14px' }}>
                    {SERVICOS.map((s) => <option key={s} value={s}>{servicoLabel[s] ?? s}</option>)}
                  </select>
                </div>
              </div>
              {(SUBROLES_POR_ROLE[form.role]?.length ?? 0) > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <SubRoleSelect
                    role={form.role}
                    value={form.subRole}
                    onChange={(v) => setForm((f) => ({ ...f, subRole: v }))}
                  />
                </div>
              )}
              <div style={{ marginBottom: '28px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Ordem Experiência <span className="text-xs text-slate-400 font-normal">(1 = mais experiente)</span></label>
                <input type="number" min="1" value={form.ordemExperiencia} onChange={setField('ordemExperiencia')}
                  placeholder="Ex: 1"
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  style={{ padding: '10px 14px' }} />
              </div>
              {erro && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" style={{ padding: '12px 16px', marginBottom: '20px' }}>
                  {erro}
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setMostrarForm(false); setErro(''); }}
                  className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  style={{ padding: '11px' }}>Cancelar</button>
                <button type="submit"
                  className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                  style={{ padding: '11px' }}>Criar Utilizador</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
