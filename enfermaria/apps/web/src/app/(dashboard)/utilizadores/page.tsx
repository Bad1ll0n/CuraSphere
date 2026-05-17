'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '../../../lib/api';

interface Utilizador {
  id: string; nome: string; numeroFuncionario: string;
  role: string; subRole?: string; servico: string;
  ordemExperiencia?: number; equipa?: string; ativo: boolean;
}
interface SubRoleOpc { id: string; chave: string; label: string; }
interface RoleOpc { id: string; chave: string; label: string; subRoles: SubRoleOpc[]; }

type AgendaDia = { ativo: boolean; horaInicio: string; horaFim: string };
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const agendaVazia = (): AgendaDia[] =>
  Array.from({ length: 7 }, (_, i) => ({
    ativo: i >= 1 && i <= 5,
    horaInicio: '08:00',
    horaFim: '13:00',
  }));

const servicoLabel: Record<string, string> = {
  internamento: 'Internamento', urgencia: 'Urgência', bloco_operatorio: 'Bloco Operatório',
  consultas_externas: 'Consultas Externas', farmacia: 'Farmácia', fisioterapia: 'Fisioterapia',
  transporte: 'Transporte', administrativo: 'Administrativo',
};
const SERVICOS = Object.keys(servicoLabel);

const roleCor: Record<string, { badge: string; dot: string }> = {
  medico:         { badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  enfermeiro:     { badge: 'bg-teal-100 text-teal-700',    dot: 'bg-teal-500' },
  auxiliar:       { badge: 'bg-slate-100 text-slate-600',  dot: 'bg-slate-400' },
  tecnico_saude:  { badge: 'bg-sky-100 text-sky-700',      dot: 'bg-sky-500' },
  farmaceutico:   { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  administrativo: { badge: 'bg-pink-100 text-pink-700',    dot: 'bg-pink-500' },
  operacional:    { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  ti:             { badge: 'bg-cyan-100 text-cyan-700',    dot: 'bg-cyan-500' },
  qualidade:      { badge: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  direcao:        { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
};

function AgendaConfig({ agenda, onChange }: { agenda: AgendaDia[]; onChange: (a: AgendaDia[]) => void }) {
  const update = (i: number, patch: Partial<AgendaDia>) =>
    onChange(agenda.map((d, idx) => idx === i ? { ...d, ...patch } : d));

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '10px' }}>
        Agenda de Consultas <span className="font-normal normal-case text-slate-400">(slots de 30 min)</span>
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {DIAS_SEMANA.map((dia, i) => (
          <div key={i} className="flex items-center gap-3" style={{ padding: '8px 12px', borderRadius: '10px', background: agenda[i].ativo ? '#f0f9ff' : '#f8fafc', border: `1px solid ${agenda[i].ativo ? '#bae6fd' : '#e2e8f0'}` }}>
            <input type="checkbox" checked={agenda[i].ativo} onChange={e => update(i, { ativo: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer', flexShrink: 0 }} />
            <span className={`text-xs font-semibold w-7 ${agenda[i].ativo ? 'text-blue-700' : 'text-slate-400'}`}>{dia}</span>
            {agenda[i].ativo ? (
              <>
                <input type="time" value={agenda[i].horaInicio} onChange={e => update(i, { horaInicio: e.target.value })}
                  className="border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  style={{ padding: '4px 8px' }} />
                <span className="text-slate-400 text-xs">até</span>
                <input type="time" value={agenda[i].horaFim} onChange={e => update(i, { horaFim: e.target.value })}
                  className="border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  style={{ padding: '4px 8px' }} />
              </>
            ) : (
              <span className="text-xs text-slate-400 italic">Sem consultas</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Avatar({ nome }: { nome: string }) {
  const initials = nome.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}

export default function UtilizadoresPagina() {
  const [utilizadores, setUtilizadores] = useState<Utilizador[]>([]);
  const [roles, setRoles] = useState<RoleOpc[]>([]);
  const [loading, setLoading] = useState(true);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ nome: '', numeroFuncionario: '', password: '', role: '', subRole: '', servico: 'internamento', ordemExperiencia: '' });
  const [erro, setErro] = useState('');

  const [editando, setEditando] = useState<Utilizador | null>(null);
  const [formEdit, setFormEdit] = useState({ nome: '', role: '', subRole: '', servico: 'internamento', ordemExperiencia: '', equipa: '', chefeId: '' });
  const [erroEdit, setErroEdit] = useState('');

  // Agenda (médicos)
  const [agendaEdit, setAgendaEdit] = useState<AgendaDia[]>(agendaVazia());
  const [agendaNovo, setAgendaNovo] = useState<AgendaDia[]>(agendaVazia());

  const carregar = useCallback(async () => {
    const [resUtil, resRoles] = await Promise.all([
      api.get('/utilizadores'),
      api.get('/configuracoes/roles'),
    ]);
    setUtilizadores(resUtil.data?.data ?? resUtil.data ?? []);
    const r: RoleOpc[] = resRoles.data;
    setRoles(r);
    if (!form.role && r.length > 0) setForm((f) => ({ ...f, role: r[0].chave }));
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const rolesMap = Object.fromEntries(roles.map((r) => [r.chave, r]));

  const criar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro('');
    try {
      const res = await api.post('/utilizadores', {
        nome: form.nome, numeroFuncionario: form.numeroFuncionario, password: form.password,
        role: form.role, subRole: form.subRole || undefined,
        servico: form.servico,
        ordemExperiencia: form.ordemExperiencia ? Number(form.ordemExperiencia) : undefined,
      });
      await salvarNovoComAgenda(res.data.id);
      setMostrarForm(false);
      setAgendaNovo(agendaVazia());
      setForm({ nome: '', numeroFuncionario: '', password: '', role: roles[0]?.chave ?? '', subRole: '', servico: 'internamento', ordemExperiencia: '' });
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

  const abrirEditar = async (u: Utilizador) => {
    setEditando(u);
    setFormEdit({ nome: u.nome, role: u.role, subRole: u.subRole ?? '', servico: u.servico ?? 'internamento', ordemExperiencia: u.ordemExperiencia?.toString() ?? '', equipa: u.equipa ?? '', chefeId: (u as any).chefeId ?? '' });
    setErroEdit('');
    if (u.role === 'medico') {
      try {
        const res = await api.get(`/consultas/agenda/${u.id}`);
        const regras: { diaSemana: number; horaInicio: string; horaFim: string; ativo: boolean }[] = res.data;
        setAgendaEdit(agendaVazia().map((d, i) => {
          const r = regras.find(r => r.diaSemana === i && r.ativo);
          return r ? { ativo: true, horaInicio: r.horaInicio, horaFim: r.horaFim } : d;
        }));
      } catch {
        setAgendaEdit(agendaVazia());
      }
    }
  };

  const guardarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    setErroEdit('');
    try {
      await api.patch(`/utilizadores/${editando.id}`, {
        nome: formEdit.nome, role: formEdit.role, subRole: formEdit.subRole || null,
        servico: formEdit.servico,
        ordemExperiencia: formEdit.ordemExperiencia ? Number(formEdit.ordemExperiencia) : undefined,
        equipa: formEdit.equipa || undefined,
        chefeId: formEdit.chefeId || null,
      });
      if (formEdit.role === 'medico') {
        await Promise.all(agendaEdit.map((d, i) =>
          api.post('/consultas/agenda', {
            medicoId: editando.id,
            diaSemana: i,
            horaInicio: d.horaInicio,
            horaFim: d.horaFim,
            duracaoSlot: 30,
            ativo: d.ativo,
          })
        ));
      }
      setEditando(null);
      await carregar();
    } catch (err: any) {
      setErroEdit(err.response?.data?.message ?? 'Erro ao guardar alterações');
    }
  };

  const salvarNovoComAgenda = async (utilizadorId: string) => {
    if (form.role !== 'medico') return;
    await Promise.all(agendaNovo.map((d, i) =>
      api.post('/consultas/agenda', {
        medicoId: utilizadorId,
        diaSemana: i,
        horaInicio: d.horaInicio,
        horaFim: d.horaFim,
        duracaoSlot: 30,
        ativo: d.ativo,
      })
    ));
  };

  const ROLE_LABEL_MAP: Record<string, string> = {
    medico: 'Médicos', enfermeiro: 'Enfermeiros', auxiliar: 'Auxiliares',
    tecnico_saude: 'Técnicos de Saúde', farmaceutico: 'Farmacêuticos',
    administrativo: 'Administrativos', operacional: 'Operacionais',
    ti: 'Tecnologias de Informação', qualidade: 'Qualidade', direcao: 'Direção',
  };
  const rolesEfetivos: RoleOpc[] = roles.length > 0
    ? roles
    : [...new Set(utilizadores.filter(u => u.ativo).map(u => u.role))]
        .map(chave => ({ id: chave, chave, label: ROLE_LABEL_MAP[chave] ?? chave, subRoles: [] }));
  const rolesComUtilizadores = rolesEfetivos.filter((r) => utilizadores.some((u) => u.role === r.chave && u.ativo));
  const porRole = Object.fromEntries(rolesEfetivos.map((r) => [r.chave, utilizadores.filter((u) => u.role === r.chave && u.ativo)]));
  const equipasExistentes = [...new Set(utilizadores.map((u) => u.equipa).filter(Boolean) as string[])].sort();

  const subRolesParaRole = (chave: string) => rolesMap[chave]?.subRoles ?? [];

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
          onClick={() => { setForm({ nome: '', numeroFuncionario: '', password: '', role: roles[0]?.chave ?? '', subRole: '', servico: 'internamento', ordemExperiencia: '' }); setMostrarForm(true); }}
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
          {rolesComUtilizadores.map((roleObj) => (
            <div key={roleObj.chave} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between" style={{ padding: '18px 24px', borderBottom: '1px solid #f8fafc' }}>
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${roleCor[roleObj.chave]?.dot ?? 'bg-slate-400'}`} />
                  <h2 className="font-semibold text-slate-800">{roleObj.label}</h2>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                  {porRole[roleObj.chave]?.length ?? 0}
                </span>
              </div>
              <div>
                {(porRole[roleObj.chave] ?? []).map((u, i, arr) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between hover:bg-slate-50 transition-colors"
                    style={{ padding: '14px 24px', borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none' }}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar nome={u.nome} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{u.nome}</p>
                        <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: '3px' }}>
                          <span className="text-xs text-slate-400">Nº {u.numeroFuncionario}</span>
                          {u.equipa && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Equipa {u.equipa}</span>}
                          {u.ordemExperiencia && <span className="text-xs text-slate-400">#{u.ordemExperiencia} experiência</span>}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleCor[roleObj.chave]?.badge ?? 'bg-slate-100 text-slate-600'}`}>
                            {roleObj.label}
                          </span>
                          {u.subRole && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                              {roleObj.subRoles.find((sr) => sr.chave === u.subRole)?.label ?? u.subRole}
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
                      <button onClick={() => abrirEditar(u)} className="text-xs font-medium text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" style={{ padding: '6px 12px' }}>Editar</button>
                      <button onClick={() => desativar(u.id)} className="text-xs font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" style={{ padding: '6px 12px' }}>Desativar</button>
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
                <input required value={formEdit.nome} onChange={(e) => setFormEdit((f) => ({ ...f, nome: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  style={{ padding: '10px 14px' }} />
              </div>
              <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '16px' }}>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Função</label>
                  <select value={formEdit.role} onChange={(e) => setFormEdit((f) => ({ ...f, role: e.target.value, subRole: '' }))}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white transition"
                    style={{ padding: '10px 14px' }}>
                    {roles.map((r) => <option key={r.chave} value={r.chave}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Serviço</label>
                  <select value={formEdit.servico} onChange={(e) => setFormEdit((f) => ({ ...f, servico: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white transition"
                    style={{ padding: '10px 14px' }}>
                    {SERVICOS.map((s) => <option key={s} value={s}>{servicoLabel[s]}</option>)}
                  </select>
                </div>
              </div>
              {subRolesParaRole(formEdit.role).length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Especialização</label>
                  <select value={formEdit.subRole} onChange={(e) => setFormEdit((f) => ({ ...f, subRole: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white transition"
                    style={{ padding: '10px 14px' }}>
                    <option value="">Sem especialização</option>
                    {subRolesParaRole(formEdit.role).map((sr) => <option key={sr.chave} value={sr.chave}>{sr.label}</option>)}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: '16px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Chefe Directo</label>
                <select value={formEdit.chefeId} onChange={(e) => setFormEdit((f) => ({ ...f, chefeId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white transition"
                  style={{ padding: '10px 14px' }}>
                  <option value="">Sem chefe atribuído</option>
                  {utilizadores.filter(u => u.id !== editando?.id).map(u => (
                    <option key={u.id} value={u.id}>{u.nome} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Ordem Experiência <span className="text-xs text-slate-400 font-normal">(1 = mais experiente)</span></label>
                <input type="number" min="1" value={formEdit.ordemExperiencia} onChange={(e) => setFormEdit((f) => ({ ...f, ordemExperiencia: e.target.value }))}
                  placeholder="Ex: 1" className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition" style={{ padding: '10px 14px' }} />
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
                <input value={formEdit.equipa} onChange={(e) => setFormEdit((f) => ({ ...f, equipa: e.target.value }))}
                  placeholder="Nome da equipa (ex: A, Alfa, Turno 1...)"
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  style={{ padding: '10px 14px' }} />
                <p className="text-xs text-slate-400" style={{ marginTop: '6px' }}>Deixe em branco para remover da equipa</p>
              </div>
              {formEdit.role === 'medico' && (
                <div style={{ marginBottom: '28px' }}>
                  <div className="border-t border-slate-100" style={{ marginBottom: '20px', marginTop: '4px' }} />
                  <AgendaConfig agenda={agendaEdit} onChange={setAgendaEdit} />
                </div>
              )}
              {erroEdit && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" style={{ padding: '12px 16px', marginBottom: '20px' }}>{erroEdit}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditando(null)} className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors" style={{ padding: '11px' }}>Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors" style={{ padding: '11px' }}>Guardar Alterações</button>
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
                <input required value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  style={{ padding: '10px 14px' }} />
              </div>
              <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '20px' }}>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Nº Funcionário</label>
                  <input required value={form.numeroFuncionario} onChange={(e) => setForm((f) => ({ ...f, numeroFuncionario: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                    style={{ padding: '10px 14px' }} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Password</label>
                  <input type="password" required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                    style={{ padding: '10px 14px' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '16px' }}>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Função</label>
                  <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, subRole: '' }))}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition bg-white"
                    style={{ padding: '10px 14px' }}>
                    {roles.map((r) => <option key={r.chave} value={r.chave}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Serviço</label>
                  <select value={form.servico} onChange={(e) => setForm((f) => ({ ...f, servico: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition bg-white"
                    style={{ padding: '10px 14px' }}>
                    {SERVICOS.map((s) => <option key={s} value={s}>{servicoLabel[s]}</option>)}
                  </select>
                </div>
              </div>
              {subRolesParaRole(form.role).length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Especialização</label>
                  <select value={form.subRole} onChange={(e) => setForm((f) => ({ ...f, subRole: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white transition"
                    style={{ padding: '10px 14px' }}>
                    <option value="">Sem especialização</option>
                    {subRolesParaRole(form.role).map((sr) => <option key={sr.chave} value={sr.chave}>{sr.label}</option>)}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: '28px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Ordem Experiência <span className="text-xs text-slate-400 font-normal">(1 = mais experiente)</span></label>
                <input type="number" min="1" value={form.ordemExperiencia} onChange={(e) => setForm((f) => ({ ...f, ordemExperiencia: e.target.value }))}
                  placeholder="Ex: 1"
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  style={{ padding: '10px 14px' }} />
              </div>
              {form.role === 'medico' && (
                <div style={{ marginBottom: '28px' }}>
                  <div className="border-t border-slate-100" style={{ marginBottom: '20px' }} />
                  <AgendaConfig agenda={agendaNovo} onChange={setAgendaNovo} />
                </div>
              )}
              {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" style={{ padding: '12px 16px', marginBottom: '20px' }}>{erro}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setMostrarForm(false); setErro(''); setAgendaNovo(agendaVazia()); }}
                  className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors" style={{ padding: '11px' }}>Cancelar</button>
                <button type="submit"
                  className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors" style={{ padding: '11px' }}>Criar Utilizador</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
