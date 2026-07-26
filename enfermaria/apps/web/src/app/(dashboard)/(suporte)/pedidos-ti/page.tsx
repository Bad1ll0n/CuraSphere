'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';

interface Utilizador { id: string; nome: string; role: string }
interface PedidoTI {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  estado: string;
  urgente: boolean;
  criadoEm: string;
  resolvidoEm: string | null;
  criadoPor: Utilizador;
  responsavel: Utilizador | null;
}

// role === 'ti' check used inline

const tipoLabel: Record<string, string> = {
  listagem_dados:  'Listagem de Dados',
  relatorio:       'Relatório',
  acesso_sistema:  'Acesso a Sistema',
  backup:          'Backup',
  auditoria_dados: 'Auditoria de Dados',
  outro:           'Outro',
};

const estadoConfig: Record<string, { label: string; pill: string }> = {
  pendente:   { label: 'Pendente',   pill: 'bg-amber-50 text-amber-700 border border-amber-200' },
  em_curso:   { label: 'Em Curso',   pill: 'bg-blue-50 text-blue-700 border border-blue-200' },
  concluido:  { label: 'Concluído',  pill: 'bg-green-50 text-green-700 border border-green-200' },
  recusado:   { label: 'Recusado',   pill: 'bg-red-50 text-red-700 border border-red-200' },
};

const FILTROS = [
  { key: '',          label: 'Todos' },
  { key: 'pendente',  label: 'Pendentes' },
  { key: 'em_curso',  label: 'Em Curso' },
  { key: 'concluido', label: 'Concluídos' },
  { key: 'recusado',  label: 'Recusados' },
];

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function PedidosTIPage() {
  const { utilizador } = useAuth();
  const isTI = utilizador?.role === 'ti';

  const [pedidos, setPedidos] = useState<PedidoTI[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);

  // modal novo pedido
  const [modal, setModal] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('outro');
  const [urgente, setUrgente] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<PedidoTI[]>('/pedidos-ti');
      setPedidos(r.data);
    } catch {
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const alterarEstado = async (id: string, estado: string) => {
    setSalvando(id + estado);
    try {
      await api.patch(`/pedidos-ti/${id}`, { estado });
      await carregar();
      setExpandido(null);
    } finally { setSalvando(null); }
  };

  const criarPedido = async () => {
    if (!titulo.trim() || !descricao.trim()) { setErroModal('Preenche título e descrição'); return; }
    setCriando(true); setErroModal('');
    try {
      await api.post('/pedidos-ti', { titulo, descricao, tipo, urgente });
      setModal(false); setTitulo(''); setDescricao(''); setTipo('outro'); setUrgente(false);
      await carregar();
    } catch (e: any) {
      setErroModal(e.response?.data?.message ?? 'Erro ao criar pedido');
    } finally { setCriando(false); }
  };

  const visíveis = filtro ? pedidos.filter((p) => p.estado === filtro) : pedidos;

  const contadores = {
    pendente:  pedidos.filter((p) => p.estado === 'pendente').length,
    em_curso:  pedidos.filter((p) => p.estado === 'em_curso').length,
    concluido: pedidos.filter((p) => p.estado === 'concluido').length,
    recusado:  pedidos.filter((p) => p.estado === 'recusado').length,
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Pedidos TI</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>
            {isTI ? 'Gestão de pedidos internos de tecnologia de informação' : 'Os teus pedidos ao departamento de TI'}
          </p>
        </div>
        <button
          onClick={() => { setModal(true); setErroModal(''); }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
          style={{ padding: '11px 22px', fontSize: '14px' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Pedido
        </button>
      </div>

      {/* Estatísticas (só TI) */}
      {isTI && (
        <div className="grid grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
          {[
            { key: 'pendente',  label: 'Pendentes',  cor: 'text-amber-600', bg: 'bg-amber-50',  border: 'border-amber-100' },
            { key: 'em_curso',  label: 'Em Curso',   cor: 'text-blue-600',  bg: 'bg-blue-50',   border: 'border-blue-100' },
            { key: 'concluido', label: 'Concluídos', cor: 'text-green-600', bg: 'bg-green-50',  border: 'border-green-100' },
            { key: 'recusado',  label: 'Recusados',  cor: 'text-red-600',   bg: 'bg-red-50',    border: 'border-red-100' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setFiltro(filtro === s.key ? '' : s.key)}
              className={`rounded-2xl border text-left transition-all ${s.bg} ${s.border} ${filtro === s.key ? 'ring-2 ring-blue-400' : 'hover:shadow-sm'}`}
              style={{ padding: '20px 24px' }}
            >
              <p className={`text-2xl font-bold ${s.cor}`}>{contadores[s.key as keyof typeof contadores]}</p>
              <p className="text-sm text-slate-500 font-medium" style={{ marginTop: '4px' }}>{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2" style={{ marginBottom: '20px' }}>
        {FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`text-sm font-medium rounded-xl filter-pad py-2 transition-colors ${
              filtro === f.key
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 text-slate-400" style={{ paddingTop: '80px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar...</span>
        </div>
      ) : visíveis.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center" style={{ padding: '80px' }}>
          <svg className="w-12 h-12 text-slate-300" style={{ marginBottom: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-slate-500 font-medium">Sem pedidos</p>
          <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>Clica em "Novo Pedido" para submeter um pedido ao departamento TI</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visíveis.map((p) => {
            const cfg = estadoConfig[p.estado];
            const aberto = expandido === p.id;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Cabeçalho do card */}
                <button
                  onClick={() => setExpandido(aberto ? null : p.id)}
                  className="w-full flex items-center gap-4 text-left hover:bg-slate-50 transition-colors"
                  style={{ padding: '18px 24px' }}
                >
                  {/* Urgente indicator */}
                  <div className={`w-1 self-stretch rounded-full shrink-0 ${p.urgente ? 'bg-red-400' : 'bg-slate-200'}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '4px' }}>
                      <span className="text-sm font-semibold text-slate-800">{p.titulo}</span>
                      {p.urgente && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 badge-pad py-0.5 rounded-full">Urgente</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-slate-400">{tipoLabel[p.tipo] ?? p.tipo}</span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-400">{p.criadoPor.nome}</span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-400">{formatarData(p.criadoEm)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium badge-pad py-1 rounded-lg ${cfg.pill}`}>{cfg.label}</span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Detalhe expandido */}
                {aberto && (
                  <div className="border-t border-slate-100" style={{ padding: '20px 24px' }}>
                    <p className="text-sm text-slate-600" style={{ marginBottom: '16px' }}>{p.descricao}</p>

                    <div className="grid grid-cols-3 gap-4" style={{ marginBottom: isTI ? '20px' : '0' }}>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400" style={{ marginBottom: '4px' }}>Criado por</p>
                        <p className="text-sm text-slate-700">{p.criadoPor.nome}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400" style={{ marginBottom: '4px' }}>Responsável</p>
                        <p className="text-sm text-slate-700">{p.responsavel?.nome ?? '—'}</p>
                      </div>
                      {p.resolvidoEm && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400" style={{ marginBottom: '4px' }}>Resolvido em</p>
                          <p className="text-sm text-slate-700">{formatarData(p.resolvidoEm)}</p>
                        </div>
                      )}
                    </div>

                    {/* Ações TI */}
                    {isTI && (
                      <div className="flex gap-2 flex-wrap">
                        {p.estado === 'pendente' && (
                          <>
                            <button
                              onClick={() => alterarEstado(p.id, 'em_curso')}
                              disabled={!!salvando}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                              style={{ padding: '8px 16px' }}
                            >
                              {salvando === p.id + 'em_curso' ? 'A guardar...' : 'Iniciar'}
                            </button>
                            <button
                              onClick={() => alterarEstado(p.id, 'recusado')}
                              disabled={!!salvando}
                              className="border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
                              style={{ padding: '8px 16px' }}
                            >
                              Recusar
                            </button>
                          </>
                        )}
                        {p.estado === 'em_curso' && (
                          <button
                            onClick={() => alterarEstado(p.id, 'concluido')}
                            disabled={!!salvando}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                            style={{ padding: '8px 16px' }}
                          >
                            {salvando === p.id + 'concluido' ? 'A guardar...' : 'Marcar Concluído'}
                          </button>
                        )}
                        {(p.estado === 'concluido' || p.estado === 'recusado') && (
                          <button
                            onClick={() => alterarEstado(p.id, 'pendente')}
                            disabled={!!salvando}
                            className="border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
                            style={{ padding: '8px 16px' }}
                          >
                            Reabrir
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal novo pedido */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '520px', padding: '32px', margin: '0 16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-xl font-bold text-slate-900">Novo Pedido TI</h2>
              <button aria-label="Fechar" onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Título</label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Acesso ao sistema de faturação"
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                style={{ padding: '10px 14px' }}
              >
                {Object.entries(tipoLabel).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Descrição</label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreve o pedido em detalhe..."
                rows={4}
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
                style={{ padding: '10px 14px' }}
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer" style={{ marginBottom: '24px' }}>
              <div
                onClick={() => setUrgente(!urgente)}
                className={`w-10 h-6 rounded-full transition-colors relative ${urgente ? 'bg-red-500' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${urgente ? 'left-5' : 'left-1'}`} />
              </div>
              <span className="text-sm font-medium text-slate-700">Urgente</span>
            </label>

            {erroModal && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" style={{ padding: '12px 16px', marginBottom: '16px' }}>
                {erroModal}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setModal(false)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}
              >
                Cancelar
              </button>
              <button
                onClick={criarPedido}
                disabled={criando}
                className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                style={{ padding: '11px' }}
              >
                {criando ? 'A enviar...' : 'Submeter Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
