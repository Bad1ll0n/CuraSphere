'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';

interface Utilizador {
  id: string;
  nome: string;
  numeroFuncionario: string;
  role: string;
  ordemExperiencia?: number;
  equipa?: string;
  ativo: boolean;
}

const roleLabel: Record<string, string> = {
  enfermeiro: 'Enfermeiro',
  auxiliar: 'Auxiliar',
  medico: 'Médico',
  chefe_turno: 'Chefe de Turno',
  chefe_enfermeiros: 'Chefe de Enfermeiros',
  administrativo: 'Administrativo',
};

const roleCor: Record<string, { badge: string; dot: string }> = {
  enfermeiro:        { badge: 'bg-teal-100 text-teal-700',    dot: 'bg-teal-500' },
  auxiliar:          { badge: 'bg-slate-100 text-slate-600',  dot: 'bg-slate-400' },
  medico:            { badge: 'bg-violet-100 text-violet-700',dot: 'bg-violet-500' },
  chefe_turno:       { badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
  chefe_enfermeiros: { badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  administrativo:    { badge: 'bg-pink-100 text-pink-700',    dot: 'bg-pink-500' },
};

const roles = Object.keys(roleLabel);

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
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ nome: '', numeroFuncionario: '', password: '', role: 'enfermeiro', ordemExperiencia: '' });
  const [erro, setErro] = useState('');

  const [editando, setEditando] = useState<Utilizador | null>(null);
  const [formEdit, setFormEdit] = useState({ nome: '', role: 'enfermeiro', ordemExperiencia: '', equipa: '' });
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
        ...form,
        ordemExperiencia: form.ordemExperiencia ? Number(form.ordemExperiencia) : undefined,
      });
      setMostrarForm(false);
      setForm({ nome: '', numeroFuncionario: '', password: '', role: 'enfermeiro', ordemExperiencia: '' });
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

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const abrirEditar = (u: Utilizador) => {
    setEditando(u);
    setFormEdit({ nome: u.nome, role: u.role, ordemExperiencia: u.ordemExperiencia?.toString() ?? '', equipa: u.equipa ?? '' });
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
        ordemExperiencia: formEdit.ordemExperiencia ? Number(formEdit.ordemExperiencia) : undefined,
        equipa: formEdit.equipa || undefined,
      });
      setEditando(null);
      await carregar();
    } catch (err: any) {
      setErroEdit(err.response?.data?.message ?? 'Erro ao guardar alterações');
    }
  };

  const porRole = roles.reduce<Record<string, Utilizador[]>>((acc, role) => {
    acc[role] = utilizadores.filter((u) => u.role === role && u.ativo);
    return acc;
  }, {});

  const rolesComUtilizadores = roles.filter((r) => porRole[r].length > 0);
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
              {/* Cabeçalho do grupo */}
              <div className="flex items-center justify-between" style={{ padding: '18px 24px', borderBottom: '1px solid #f8fafc' }}>
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${roleCor[role].dot}`} />
                  <h2 className="font-semibold text-slate-800">{roleLabel[role]}</h2>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                  {porRole[role].length}
                </span>
              </div>

              {/* Lista */}
              <div>
                {porRole[role].map((u, i) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between hover:bg-slate-50 transition-colors"
                    style={{
                      padding: '14px 24px',
                      borderBottom: i < porRole[role].length - 1 ? '1px solid #f8fafc' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar nome={u.nome} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{u.nome}</p>
                        <div className="flex items-center gap-2" style={{ marginTop: '3px' }}>
                          <span className="text-xs text-slate-400">Nº {u.numeroFuncionario}</span>
                          {u.equipa && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              Equipa {u.equipa}
                            </span>
                          )}
                          {u.ordemExperiencia && (
                            <>
                              <span className="text-slate-200">·</span>
                              <span className="text-xs text-slate-400">Exp. {u.ordemExperiencia}</span>
                            </>
                          )}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleCor[role].badge}`}>
                            {roleLabel[role]}
                          </span>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" style={{ padding: '32px' }}>
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
              <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '20px' }}>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Função</label>
                  <select
                    value={formEdit.role}
                    onChange={(e) => setFormEdit((f) => ({ ...f, role: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white transition"
                    style={{ padding: '10px 14px' }}
                  >
                    {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Ordem Experiência</label>
                  <input
                    type="number"
                    value={formEdit.ordemExperiencia}
                    onChange={(e) => setFormEdit((f) => ({ ...f, ordemExperiencia: e.target.value }))}
                    placeholder="Opcional"
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
                    style={{ padding: '10px 14px' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '28px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Equipa</label>
                {/* Equipas existentes como opções rápidas */}
                {equipasExistentes.length > 0 && (
                  <div className="flex flex-wrap gap-2" style={{ marginBottom: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setFormEdit((f) => ({ ...f, equipa: '' }))}
                      className={`text-xs font-medium rounded-lg border transition-all ${formEdit.equipa === '' ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      style={{ padding: '4px 12px' }}
                    >
                      Sem equipa
                    </button>
                    {equipasExistentes.map((eq) => (
                      <button
                        key={eq}
                        type="button"
                        onClick={() => setFormEdit((f) => ({ ...f, equipa: eq }))}
                        className={`text-xs font-medium rounded-lg border transition-all ${formEdit.equipa === eq ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                        style={{ padding: '4px 12px' }}
                      >
                        Equipa {eq}
                      </button>
                    ))}
                  </div>
                )}
                {/* Criar nova equipa */}
                <div className="flex items-center gap-2">
                  <input
                    value={formEdit.equipa}
                    onChange={(e) => setFormEdit((f) => ({ ...f, equipa: e.target.value }))}
                    placeholder="Nome da equipa (ex: A, Alfa, Turno 1...)"
                    className="flex-1 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                    style={{ padding: '10px 14px' }}
                  />
                </div>
                <p className="text-xs text-slate-400" style={{ marginTop: '6px' }}>Deixe em branco para remover da equipa</p>
              </div>
              {erroEdit && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" style={{ padding: '12px 16px', marginBottom: '20px' }}>
                  {erroEdit}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditando(null)}
                  className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  style={{ padding: '11px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                  style={{ padding: '11px' }}
                >
                  Guardar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal novo utilizador */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" style={{ padding: '32px' }}>
            <h2 className="text-xl font-bold text-slate-900" style={{ marginBottom: '28px' }}>Novo Utilizador</h2>
            <form onSubmit={criar}>
              <div style={{ marginBottom: '20px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Nome completo</label>
                <input
                  required
                  value={form.nome}
                  onChange={setField('nome')}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  style={{ padding: '10px 14px' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '20px' }}>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Nº Funcionário</label>
                  <input
                    required
                    value={form.numeroFuncionario}
                    onChange={setField('numeroFuncionario')}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                    style={{ padding: '10px 14px' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Password</label>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={setField('password')}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                    style={{ padding: '10px 14px' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '28px' }}>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Função</label>
                  <select
                    value={form.role}
                    onChange={setField('role')}
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition bg-white"
                    style={{ padding: '10px 14px' }}
                  >
                    {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>Ordem Experiência</label>
                  <input
                    type="number"
                    value={form.ordemExperiencia}
                    onChange={setField('ordemExperiencia')}
                    placeholder="Opcional"
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                    style={{ padding: '10px 14px' }}
                  />
                </div>
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" style={{ padding: '12px 16px', marginBottom: '20px' }}>
                  {erro}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setMostrarForm(false); setErro(''); }}
                  className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  style={{ padding: '11px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                  style={{ padding: '11px' }}
                >
                  Criar Utilizador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
