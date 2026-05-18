'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';

const TIPOS = [
  { value: 'infraestrutura', label: 'Infraestrutura' },
  { value: 'rede', label: 'Rede' },
  { value: 'his_erp', label: 'HIS / ERP' },
  { value: 'base_dados', label: 'Base de Dados' },
  { value: 'seguranca', label: 'Segurança' },
  { value: 'dados_clinicos', label: 'Dados Clínicos' },
  { value: 'outro', label: 'Outro' },
];

const PRIORIDADES = [
  { value: 'baixa',  label: 'Baixa',   cor: 'bg-green-100 text-green-700',   borda: '#22c55e' },
  { value: 'media',  label: 'Média',   cor: 'bg-yellow-100 text-yellow-700', borda: '#eab308' },
  { value: 'alta',   label: 'Alta',    cor: 'bg-orange-100 text-orange-700', borda: '#f97316' },
  { value: 'critica',label: 'Crítica', cor: 'bg-red-100 text-red-700',       borda: '#ef4444' },
];

const ESTADOS = [
  { value: 'aberto',    label: 'Aberto',      cor: 'bg-red-100 text-red-700',     icone: '🔴' },
  { value: 'em_analise',label: 'Em Análise',  cor: 'bg-amber-100 text-amber-700', icone: '🟡' },
  { value: 'resolvido', label: 'Resolvido',   cor: 'bg-green-100 text-green-700', icone: '🟢' },
  { value: 'fechado',   label: 'Fechado',     cor: 'bg-slate-100 text-slate-500', icone: '⚫' },
];

const ACOES_TI: Record<string, { label: string; proximo: string; cor: string }[]> = {
  aberto:     [{ label: 'Iniciar Análise', proximo: 'em_analise', cor: 'bg-amber-500 hover:bg-amber-600 text-white' }],
  em_analise: [{ label: 'Marcar Resolvido', proximo: 'resolvido', cor: 'bg-green-600 hover:bg-green-700 text-white' }],
  resolvido:  [{ label: 'Fechar', proximo: 'fechado', cor: 'bg-slate-500 hover:bg-slate-600 text-white' }],
  fechado:    [],
};

// role === 'ti' check used inline

interface Incidente {
  id: string; titulo: string; descricao: string; tipo: string;
  subRoleAlvo: string | null; prioridade: string; estado: string; criadoEm: string;
  criadoPor: { id: string; nome: string; role: string } | null;
  responsavel: { id: string; nome: string; role: string } | null;
}

function getBorda(prioridade: string) {
  return PRIORIDADES.find(p => p.value === prioridade)?.borda ?? '#94a3b8';
}
function getPrioridadeCor(prioridade: string) {
  return PRIORIDADES.find(p => p.value === prioridade)?.cor ?? 'bg-slate-100 text-slate-500';
}
function getEstadoCor(estado: string) {
  return ESTADOS.find(e => e.value === estado)?.cor ?? 'bg-slate-100 text-slate-500';
}
function getEstadoLabel(estado: string) {
  return ESTADOS.find(e => e.value === estado)?.label ?? estado;
}
function getPrioridadeLabel(prioridade: string) {
  return PRIORIDADES.find(p => p.value === prioridade)?.label ?? prioridade;
}
function getTipoLabel(tipo: string) {
  return TIPOS.find(t => t.value === tipo)?.label ?? tipo;
}
function tempoRelativo(data: string) {
  const diff = Date.now() - new Date(data).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
}

export default function IncidentesTIPage() {
  const { utilizador } = useAuth();
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [tiUsers, setTiUsers] = useState<Array<{ id: string; nome: string }>>([]);
  const [atribuindoResp, setAtribuindoResp] = useState<string | null>(null);
  const [respDropdown, setRespDropdown] = useState<Record<string, string>>({});

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('infraestrutura');
  const [prioridade, setPrioridade] = useState('media');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    try {
      const { data } = await api.get('/incidentes-ti');
      setIncidentes(data);
    } finally {
      setLoading(false);
    }
  };

  const carregarTiUsers = async () => {
    if (tiUsers.length > 0) return;
    try {
      const { data } = await api.get('/utilizadores?roles=ti');
      const lista = Array.isArray(data) ? data : (data?.utilizadores ?? data?.data ?? []);
      setTiUsers(lista);
    } catch { /* silencioso */ }
  };

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (expandido) carregarTiUsers();
  }, [expandido]);

  const criarIncidente = async () => {
    if (!titulo.trim() || !descricao.trim()) { setErro('Título e descrição são obrigatórios'); return; }
    setSalvando(true); setErro('');
    try {
      await api.post('/incidentes-ti', { titulo, descricao, tipo, prioridade });
      setModalAberto(false);
      setTitulo(''); setDescricao(''); setTipo('infraestrutura'); setPrioridade('media');
      await carregar();
    } catch (e: any) {
      setErro(e.response?.data?.message ?? 'Erro ao criar incidente');
    } finally { setSalvando(false); }
  };

  const atualizarEstado = async (id: string, estado: string) => {
    setAtualizando(id);
    try {
      await api.patch(`/incidentes-ti/${id}`, { estado });
      setIncidentes(prev => prev.map(i => i.id === id ? { ...i, estado } : i));
    } catch { /* silencioso */ }
    finally { setAtualizando(null); }
  };

  const atribuirResponsavel = async (id: string, responsavelId: string) => {
    if (!responsavelId) return;
    setAtribuindoResp(id);
    try {
      await api.patch(`/incidentes-ti/${id}`, { responsavelId });
      const user = tiUsers.find(u => u.id === responsavelId);
      setIncidentes(prev => prev.map(i => i.id === id ? { ...i, responsavel: user ? { id: user.id, nome: user.nome, role: 'ti' } : i.responsavel } : i));
    } catch { /* silencioso */ }
    finally { setAtribuindoResp(null); }
  };

  const eTI = utilizador?.role === 'ti';

  const visiveis = incidentes.filter(i => {
    if (filtroEstado && i.estado !== filtroEstado) return false;
    if (filtroTipo && i.tipo !== filtroTipo) return false;
    return true;
  });

  const counts = {
    abertos:    incidentes.filter(i => i.estado === 'aberto').length,
    emAnalise:  incidentes.filter(i => i.estado === 'em_analise').length,
    resolvidos: incidentes.filter(i => i.estado === 'resolvido').length,
    criticos:   incidentes.filter(i => i.prioridade === 'critica' && i.estado !== 'fechado').length,
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* ── Cabeçalho ── */}
      <div className="flex items-start justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Incidentes TI</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Reporte, acompanhe e resolva problemas técnicos</p>
        </div>
        <button
          onClick={() => { setModalAberto(true); setErro(''); }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center gap-2"
          style={{ padding: '10px 20px' }}
        >
          <span className="text-lg leading-none">+</span> Novo Incidente
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        {[
          { label: 'Abertos',     value: counts.abertos,    cor: 'text-red-600',    bg: 'bg-red-50',    borda: 'border-red-200',    filtro: 'aberto' },
          { label: 'Em Análise',  value: counts.emAnalise,  cor: 'text-amber-600',  bg: 'bg-amber-50',  borda: 'border-amber-200',  filtro: 'em_analise' },
          { label: 'Resolvidos',  value: counts.resolvidos, cor: 'text-green-600',  bg: 'bg-green-50',  borda: 'border-green-200',  filtro: 'resolvido' },
          { label: 'Críticos',    value: counts.criticos,   cor: 'text-red-700',    bg: 'bg-red-50',    borda: 'border-red-300',    filtro: '' },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => s.filtro ? setFiltroEstado(filtroEstado === s.filtro ? '' : s.filtro) : undefined}
            className={`text-left rounded-2xl border ${s.bg} ${s.borda} transition-all hover:shadow-sm ${s.filtro && filtroEstado === s.filtro ? 'ring-2 ring-blue-400' : ''}`}
            style={{ padding: '16px 20px' }}
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold ${s.cor}`} style={{ marginTop: '4px' }}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div className="flex items-center gap-3" style={{ marginBottom: '20px' }}>
        <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
          {[{ value: '', label: 'Todos' }, ...ESTADOS].map(e => (
            <button
              key={e.value}
              onClick={() => setFiltroEstado(e.value)}
              className={`text-sm font-semibold rounded-lg filter-pad py-2 transition-all ${filtroEstado === e.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {'label' in e ? e.label : e.value}
            </button>
          ))}
        </div>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border border-slate-200 rounded-xl text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ padding: '7px 12px' }}
        >
          <option value="">Todos os tipos</option>
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {(filtroEstado || filtroTipo) && (
          <button onClick={() => { setFiltroEstado(''); setFiltroTipo(''); }} className="text-xs text-slate-400 hover:text-slate-600 underline">
            Limpar
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto">{visiveis.length} incidente{visiveis.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 text-slate-400" style={{ padding: '80px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar...</span>
        </div>
      ) : visiveis.length === 0 ? (
        <div className="text-center bg-white rounded-2xl border border-slate-100" style={{ padding: '72px 32px' }}>
          <div className="text-5xl" style={{ marginBottom: '16px' }}>✅</div>
          <p className="text-lg font-semibold text-slate-700">Tudo limpo por aqui</p>
          <p className="text-sm text-slate-400" style={{ marginTop: '6px' }}>
            {filtroEstado || filtroTipo ? 'Sem incidentes com este filtro' : 'Nenhum incidente registado. Clique em "Novo Incidente" para começar.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visiveis.map(inc => {
            const aberto = expandido === inc.id;
            const acoes = eTI ? (ACOES_TI[inc.estado] ?? []) : [];
            const borda = getBorda(inc.prioridade);
            return (
              <div
                key={inc.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                style={{ borderLeft: `4px solid ${borda}` }}
              >
                {/* Linha principal */}
                <div
                  className="flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ padding: '16px 20px' }}
                  onClick={() => setExpandido(aberto ? null : inc.id)}
                >
                  {/* Título + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                      <p className="font-semibold text-slate-900 text-sm truncate">{inc.titulo}</p>
                      {inc.prioridade === 'critica' && (
                        <span className="shrink-0 text-xs font-bold text-red-600 bg-red-50 rounded badge-pad py-0.5">⚠ Crítico</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{inc.descricao}</p>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-500 bg-slate-100 rounded-lg px-2 py-1">{getTipoLabel(inc.tipo)}</span>
                    <span className={`text-xs font-semibold rounded-full badge-pad py-1 ${getPrioridadeCor(inc.prioridade)}`}>
                      {getPrioridadeLabel(inc.prioridade)}
                    </span>
                    <span className={`text-xs font-semibold rounded-full badge-pad py-1 ${getEstadoCor(inc.estado)}`}>
                      {getEstadoLabel(inc.estado)}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="text-right shrink-0" style={{ minWidth: '80px' }}>
                    <p className="text-xs text-slate-500">{inc.criadoPor?.nome ?? '—'}</p>
                    <p className="text-xs text-slate-300">{tempoRelativo(inc.criadoEm)}</p>
                  </div>

                  {/* Chevron */}
                  <svg className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${aberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Detalhe expandido */}
                {aberto && (
                  <div className="border-t border-slate-100" style={{ padding: '20px 24px', backgroundColor: '#f8fafc' }}>
                    <div className="grid grid-cols-3 gap-6">
                      {/* Descrição completa */}
                      <div className="col-span-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Descrição</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{inc.descricao}</p>

                        <div style={{ marginTop: '16px' }}>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Responsável</p>
                          {eTI ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={respDropdown[inc.id] ?? inc.responsavel?.id ?? ''}
                                onChange={e => setRespDropdown(prev => ({ ...prev, [inc.id]: e.target.value }))}
                                className="flex-1 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                style={{ padding: '6px 10px' }}
                              >
                                <option value="">— Sem responsável —</option>
                                {tiUsers.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                              </select>
                              <button
                                onClick={() => atribuirResponsavel(inc.id, respDropdown[inc.id] ?? '')}
                                disabled={atribuindoResp === inc.id || !respDropdown[inc.id]}
                                className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}
                              >
                                {atribuindoResp === inc.id ? '...' : 'Guardar'}
                              </button>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-700">{inc.responsavel?.nome ?? '—'}</p>
                          )}
                        </div>
                      </div>

                      {/* Info + Ações */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '10px' }}>Detalhes</p>
                        <div className="flex flex-col gap-2" style={{ marginBottom: '16px' }}>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Tipo</span>
                            <span className="text-slate-700 font-medium">{getTipoLabel(inc.tipo)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Prioridade</span>
                            <span className={`font-semibold rounded-full badge-pad py-0.5 ${getPrioridadeCor(inc.prioridade)}`}>{getPrioridadeLabel(inc.prioridade)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Estado</span>
                            <span className={`font-semibold rounded-full badge-pad py-0.5 ${getEstadoCor(inc.estado)}`}>{getEstadoLabel(inc.estado)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Criado por</span>
                            <span className="text-slate-700 font-medium">{inc.criadoPor?.nome ?? '—'}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Data</span>
                            <span className="text-slate-700">{new Date(inc.criadoEm).toLocaleDateString('pt-PT')}</span>
                          </div>
                          {inc.subRoleAlvo && (
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Equipa</span>
                              <span className="text-slate-700 font-medium">{inc.subRoleAlvo}</span>
                            </div>
                          )}
                        </div>

                        {/* Ações TI */}
                        {eTI && acoes.length > 0 && (
                          <div className="flex flex-col gap-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ações</p>
                            {acoes.map(a => (
                              <button
                                key={a.proximo}
                                onClick={() => atualizarEstado(inc.id, a.proximo)}
                                disabled={atualizando === inc.id}
                                className={`w-full text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 ${a.cor}`}
                                style={{ padding: '10px' }}
                              >
                                {atualizando === inc.id ? 'A atualizar...' : a.label}
                              </button>
                            ))}
                            {/* Reabrir se resolvido/fechado */}
                            {(inc.estado === 'resolvido' || inc.estado === 'fechado') && (
                              <button
                                onClick={() => atualizarEstado(inc.id, 'aberto')}
                                disabled={atualizando === inc.id}
                                className="w-full text-xs font-semibold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
                                style={{ padding: '8px' }}
                              >
                                Reabrir
                              </button>
                            )}
                          </div>
                        )}

                        {/* Estado completo para todos os roles TI */}
                        {eTI && acoes.length === 0 && inc.estado !== 'fechado' && (
                          <button
                            onClick={() => atualizarEstado(inc.id, 'aberto')}
                            disabled={atualizando === inc.id}
                            className="w-full text-xs font-semibold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                            style={{ padding: '8px' }}
                          >
                            Reabrir
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Novo Incidente ── */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '520px', margin: '0 16px' }}>
            {/* Header modal */}
            <div className="flex items-center justify-between border-b border-slate-100" style={{ padding: '20px 28px' }}>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Novo Incidente TI</h2>
                <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Será encaminhado automaticamente à equipa responsável</p>
              </div>
              <button onClick={() => setModalAberto(false)} className="text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors" style={{ padding: '6px' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{ padding: '24px 28px' }}>
              {/* Prioridade selector visual */}
              <div style={{ marginBottom: '18px' }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Prioridade</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRIORIDADES.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPrioridade(p.value)}
                      className={`text-xs font-semibold rounded-xl py-2 border-2 transition-all ${prioridade === p.value ? `${p.cor} border-current` : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo */}
              <div style={{ marginBottom: '14px' }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo de Problema</label>
                <select
                  value={tipo}
                  onChange={e => setTipo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }}
                >
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Título */}
              <div style={{ marginBottom: '14px' }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Título</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Resumo claro do problema"
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }}
                />
              </div>

              {/* Descrição */}
              <div style={{ marginBottom: '18px' }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Descrição</label>
                <textarea
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Descreva o problema: o que aconteceu, quando, impacto..."
                  rows={4}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ padding: '10px 14px' }}
                />
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm" style={{ padding: '10px 14px', marginBottom: '14px' }}>
                  {erro}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setModalAberto(false)}
                  className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm"
                  style={{ padding: '11px' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={criarIncidente}
                  disabled={salvando || !titulo.trim() || !descricao.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 text-sm"
                  style={{ padding: '11px' }}
                >
                  {salvando ? 'A criar...' : 'Criar Incidente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
