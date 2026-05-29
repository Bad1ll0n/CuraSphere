'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface SubRole { id: string; chave: string; label: string; roleChave: string; ordem: number; ativo: boolean; }
interface Role { id: string; chave: string; label: string; categoria: string; ordem: number; ativo: boolean; subRoles: SubRole[]; }

type ModalMode = 'criar-role' | 'editar-role' | 'criar-subrole' | 'editar-subrole' | null;

const categoriaLabel: Record<string, string> = {
  clinico: 'Clínico', suporte: 'Suporte', gestao: 'Gestão', ti: 'TI',
};
const categoriaColor: Record<string, string> = {
  clinico: 'bg-violet-500/15 text-violet-400',
  suporte: 'bg-orange-500/15 text-orange-400',
  gestao:  'bg-yellow-500/15 text-yellow-400',
  ti:      'bg-cyan-500/15 text-cyan-400',
};

export default function ConfiguracoesPage() {
  const { utilizador, loading } = useAuth();
  const router = useRouter();

  const [roles, setRoles] = useState<Role[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState<ModalMode>(null);
  const [roleAlvo, setRoleAlvo] = useState<Role | null>(null);
  const [subRoleAlvo, setSubRoleAlvo] = useState<SubRole | null>(null);
  const [salvando, setSalvando] = useState(false);

  // form state
  const [fChave, setFChave] = useState('');
  const [fLabel, setFLabel] = useState('');
  const [fCategoria, setFCategoria] = useState('clinico');
  const [fOrdem, setFOrdem] = useState('');
  const [fRoleChave, setFRoleChave] = useState('');

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get('/configuracoes/roles');
      setRoles(data);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && (!utilizador || utilizador.role !== 'ti' || utilizador.subRole !== 'it_admin')) {
      router.replace('/dashboard-ti');
      return;
    }
    if (!loading && utilizador) carregar();
  }, [utilizador, loading, router, carregar]);

  const abrirCriarRole = () => {
    setFChave(''); setFLabel(''); setFCategoria('clinico'); setFOrdem('');
    setModal('criar-role');
  };
  const abrirEditarRole = (r: Role) => {
    setRoleAlvo(r); setFLabel(r.label); setFCategoria(r.categoria); setFOrdem(String(r.ordem));
    setModal('editar-role');
  };
  const abrirCriarSubRole = (roleChave: string) => {
    setFChave(''); setFLabel(''); setFOrdem(''); setFRoleChave(roleChave);
    setModal('criar-subrole');
  };
  const abrirEditarSubRole = (sr: SubRole) => {
    setSubRoleAlvo(sr); setFLabel(sr.label); setFOrdem(String(sr.ordem));
    setModal('editar-subrole');
  };

  const fecharModal = () => { setModal(null); setRoleAlvo(null); setSubRoleAlvo(null); };

  const submeter = async () => {
    setSalvando(true);
    try {
      if (modal === 'criar-role') {
        await api.post('/configuracoes/roles', { chave: fChave, label: fLabel, categoria: fCategoria, ordem: fOrdem ? Number(fOrdem) : undefined });
      } else if (modal === 'editar-role' && roleAlvo) {
        await api.patch(`/configuracoes/roles/${roleAlvo.id}`, { label: fLabel, categoria: fCategoria, ordem: fOrdem ? Number(fOrdem) : undefined });
      } else if (modal === 'criar-subrole') {
        await api.post('/configuracoes/subroles', { chave: fChave, label: fLabel, roleChave: fRoleChave, ordem: fOrdem ? Number(fOrdem) : undefined });
      } else if (modal === 'editar-subrole' && subRoleAlvo) {
        await api.patch(`/configuracoes/subroles/${subRoleAlvo.id}`, { label: fLabel, ordem: fOrdem ? Number(fOrdem) : undefined });
      }
      fecharModal();
      await carregar();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao guardar');
    } finally {
      setSalvando(false);
    }
  };

  const desativarRole = async (id: string, chave: string) => {
    if (!confirm(`Desativar a role "${chave}"? Utilizadores com esta role ficam inacessíveis.`)) return;
    await api.delete(`/configuracoes/roles/${id}`);
    await carregar();
  };

  const desativarSubRole = async (id: string, chave: string) => {
    if (!confirm(`Desativar o sub-role "${chave}"?`)) return;
    await api.delete(`/configuracoes/subroles/${id}`);
    await carregar();
  };

  if (loading || carregando) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-400">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">A carregar...</span>
      </div>
    </div>
  );

  const isCriarRole    = modal === 'criar-role';
  const isEditarRole   = modal === 'editar-role';
  const isCriarSub     = modal === 'criar-subrole';
  const isEditarSub    = modal === 'editar-subrole';
  const modalAberto    = modal !== null;
  const modalTitulo    = isCriarRole ? 'Nova Role' : isEditarRole ? 'Editar Role' : isCriarSub ? 'Novo Sub-Role' : isEditarSub ? 'Editar Sub-Role' : '';

  return (
    <div style={{ padding: '40px 48px', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '36px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Gestão de roles e sub-roles do sistema</p>
        </div>
        <button
          onClick={abrirCriarRole}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
          style={{ padding: '10px 20px' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Role
        </button>
      </div>

      {/* Lista de Roles */}
      <div className="flex flex-col gap-4">
        {roles.map((role) => (
          <div key={role.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Cabeçalho da Role */}
            <div
              className="flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
              style={{ padding: '20px 24px' }}
              onClick={() => setExpandido(expandido === role.id ? null : role.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-900">{role.label}</span>
                  <span className="font-mono text-xs text-slate-400 bg-slate-100 rounded-md" style={{ padding: '2px 10px' }}>{role.chave}</span>
                  <span className={`text-[11px] font-semibold rounded-full ${categoriaColor[role.categoria] ?? 'bg-slate-100 text-slate-500'}`} style={{ padding: '2px 10px' }}>
                    {categoriaLabel[role.categoria] ?? role.categoria}
                  </span>
                </div>
                <p className="text-slate-400 text-xs" style={{ marginTop: '4px' }}>
                  {role.subRoles.length} sub-{role.subRoles.length === 1 ? 'role' : 'roles'} · ordem {role.ordem}
                </p>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => abrirEditarRole(role)}
                  className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg text-sm transition-colors"
                  style={{ padding: '6px 12px' }}
                >Editar</button>
                <button
                  onClick={() => desativarRole(role.id, role.chave)}
                  className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg text-sm transition-colors"
                  style={{ padding: '6px 12px' }}
                >Desativar</button>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandido === role.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Sub-Roles */}
            {expandido === role.id && (
              <div className="border-t border-slate-100" style={{ padding: '0 24px 20px' }}>
                <div className="flex items-center justify-between" style={{ paddingTop: '16px', marginBottom: '12px' }}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sub-Roles</p>
                  <button
                    onClick={() => abrirCriarSubRole(role.chave)}
                    className="flex items-center gap-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-semibold transition-colors"
                    style={{ padding: '5px 10px' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Novo
                  </button>
                </div>
                {role.subRoles.length === 0 ? (
                  <p className="text-slate-400 text-sm italic">Nenhum sub-role configurado</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {role.subRoles.map((sr) => (
                      <div key={sr.id} className="flex items-center justify-between bg-slate-50 rounded-xl" style={{ padding: '12px 16px' }}>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-800 font-medium text-sm">{sr.label}</span>
                          <span className="font-mono text-xs text-slate-400 bg-white border border-slate-100 rounded" style={{ padding: '2px 10px' }}>{sr.chave}</span>
                          <span className="text-slate-400 text-xs">ordem {sr.ordem}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => abrirEditarSubRole(sr)}
                            className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg text-xs transition-colors"
                            style={{ padding: '4px 10px' }}
                          >Editar</button>
                          <button
                            onClick={() => desativarSubRole(sr.id, sr.chave)}
                            className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg text-xs transition-colors"
                            style={{ padding: '4px 10px' }}
                          >Desativar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">{modalTitulo}</h2>
              <button onClick={fecharModal} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            <div className="flex flex-col gap-4">
              {(isCriarRole || isCriarSub) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Chave (identificador único)</label>
                  <input
                    value={fChave} onChange={(e) => setFChave(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                    placeholder="ex: cardio_sénior"
                    className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 14px' }}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Label (nome visível)</label>
                <input
                  value={fLabel} onChange={(e) => setFLabel(e.target.value)}
                  placeholder="ex: Cardiologista Sénior"
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }}
                />
              </div>

              {(isCriarRole || isEditarRole) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Categoria</label>
                  <select
                    value={fCategoria} onChange={(e) => setFCategoria(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 14px' }}
                  >
                    <option value="clinico">Clínico</option>
                    <option value="suporte">Suporte</option>
                    <option value="gestao">Gestão</option>
                    <option value="ti">TI</option>
                  </select>
                </div>
              )}

              {isCriarSub && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Role-pai</label>
                  <input value={fRoleChave} readOnly className="w-full border border-slate-100 rounded-xl text-sm bg-slate-100 text-slate-500" style={{ padding: '10px 14px' }} />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Ordem (opcional)</label>
                <input
                  type="number" value={fOrdem} onChange={(e) => setFOrdem(e.target.value)}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }}
                />
              </div>
            </div>

            <div className="flex gap-3" style={{ marginTop: '24px' }}>
              <button onClick={fecharModal} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors" style={{ padding: '11px' }}>
                Cancelar
              </button>
              <button
                onClick={submeter}
                disabled={salvando || !fLabel || ((isCriarRole || isCriarSub) && !fChave)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}
              >
                {salvando ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
