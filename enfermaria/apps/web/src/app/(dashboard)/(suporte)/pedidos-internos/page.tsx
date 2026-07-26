'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';

interface PedidoInterno {
  id: string;
  tipo: string;
  descricao: string;
  prioridade: string;
  estado: string;
  localOrigem?: string;
  localDestino?: string;
  servico: string;
  criadoEm: string;
  concluidoEm?: string;
  solicitadoPor: { id: string; nome: string };
  executadoPor?: { id: string; nome: string };
  doente?: { id: string; nome: string };
}

const PRIORIDADE_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  urgente: { label: 'Urgente', bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
  alta:    { label: 'Alta',    bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  media:   { label: 'Média',   bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  baixa:   { label: 'Baixa',   bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400' },
};

const ESTADO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pendente:   { label: 'Pendente',   bg: 'bg-amber-50',  text: 'text-amber-700' },
  em_curso:   { label: 'Em Curso',   bg: 'bg-blue-50',   text: 'text-blue-700' },
  concluido:  { label: 'Concluído',  bg: 'bg-green-50',  text: 'text-green-700' },
  cancelado:  { label: 'Cancelado',  bg: 'bg-slate-100', text: 'text-slate-600' },
};

const TIPO_LABELS: Record<string, string> = {
  transporte:      'Transporte',
  esterilizacao:   'Esterilização',
  equipamento:     'Equipamento',
  limpeza:         'Limpeza',
};

export default function PedidosInternosPage() {
  const { utilizador } = useAuth();
  const [pedidos, setPedidos] = useState<PedidoInterno[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tipo: 'transporte', descricao: '', prioridade: 'media', localOrigem: '', localDestino: '', doenteId: '' });
  const [salvando, setSalvando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const carregar = async () => {
    try {
      const { data } = await api.get('/pedidos-internos');
      setPedidos(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const criarPedido = async () => {
    if (!form.descricao.trim()) return;
    setSalvando(true);
    try {
      await api.post('/pedidos-internos', form);
      setModal(false);
      setForm({ tipo: 'transporte', descricao: '', prioridade: 'media', localOrigem: '', localDestino: '', doenteId: '' });
      carregar();
    } finally { setSalvando(false); }
  };

  const aceitar = async (id: string) => {
    await api.patch(`/pedidos-internos/${id}/aceitar`);
    carregar();
  };

  const concluir = async (id: string) => {
    await api.patch(`/pedidos-internos/${id}/concluir`);
    carregar();
  };

  const filtrados = filtroEstado === 'todos' ? pedidos : pedidos.filter(p => p.estado === filtroEstado);
  const isTransporte = utilizador?.servico === 'transporte';

  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pedidos Internos</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Transporte, esterilização, equipamentos e limpeza</p>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          style={{ padding: '10px 20px' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Pedido
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2" style={{ marginBottom: '24px' }}>
        {['todos', 'pendente', 'em_curso', 'concluido'].map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)}
            className={`text-sm font-medium rounded-xl border transition-all ${filtroEstado === e ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            style={{ padding: '9px 20px' }}>
            {e === 'todos' ? 'Todos' : ESTADO_CONFIG[e]?.label ?? e}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: '80px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '60px 40px' }}>
          <p className="text-slate-500">Nenhum pedido {filtroEstado !== 'todos' ? `com estado "${ESTADO_CONFIG[filtroEstado]?.label}"` : 'registado'}.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtrados.map(p => {
            const prio = PRIORIDADE_CONFIG[p.prioridade] ?? PRIORIDADE_CONFIG.media;
            const est = ESTADO_CONFIG[p.estado] ?? ESTADO_CONFIG.pendente;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-200 flex items-start justify-between gap-4" style={{ padding: '20px 24px' }}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full ${prio.dot} shrink-0 mt-1.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                      <p className="font-semibold text-slate-900 text-sm">{TIPO_LABELS[p.tipo] ?? p.tipo}</p>
                      <span className={`text-xs font-medium badge-pad py-0.5 rounded-full ${prio.bg} ${prio.text}`}>{prio.label}</span>
                    </div>
                    <p className="text-slate-600 text-sm">{p.descricao}</p>
                    {(p.localOrigem || p.localDestino) && (
                      <p className="text-slate-400 text-xs" style={{ marginTop: '4px' }}>
                        {p.localOrigem && `De: ${p.localOrigem}`}{p.localOrigem && p.localDestino && ' → '}{p.localDestino && `Para: ${p.localDestino}`}
                      </p>
                    )}
                    <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
                      <span className={`text-xs font-medium badge-pad py-1 rounded-full ${est.bg} ${est.text}`}>{est.label}</span>
                      <span className="text-xs text-slate-400">por {p.solicitadoPor?.nome}</span>
                      {p.executadoPor && <span className="text-xs text-slate-400">· {p.executadoPor.nome}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {p.estado === 'pendente' && isTransporte && (
                    <button onClick={() => aceitar(p.id)}
                      className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      style={{ padding: '7px 14px' }}>
                      Aceitar
                    </button>
                  )}
                  {p.estado === 'em_curso' && isTransporte && (
                    <button onClick={() => concluir(p.id)}
                      className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      style={{ padding: '7px 14px' }}>
                      Concluir
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Novo Pedido */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '480px', padding: '32px', margin: '0 16px', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Novo Pedido Interno</h2>
              <button aria-label="Fechar" onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo</label>
              <select id="fpage-0" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }}>
                {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Prioridade</label>
              <select id="fpage-1" value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }}>
                {Object.entries(PRIORIDADE_CONFIG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Descrição *</label>
              <textarea id="fpage-2" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                rows={3} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Descreva o pedido..." />
            </div>
            {[
              { label: 'Local de Origem', key: 'localOrigem', placeholder: 'Ex: Enfermaria 2, Quarto 4' },
              { label: 'Local de Destino', key: 'localDestino', placeholder: 'Ex: Bloco Operatório' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} style={{ marginBottom: '14px' }}>
                <label htmlFor="fpage-3" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{label}</label>
                <input id="fpage-3" value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }} placeholder={placeholder} />
              </div>
            ))}
            <div className="flex gap-3" style={{ marginTop: '8px' }}>
              <button onClick={() => setModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={criarPedido} disabled={salvando || !form.descricao.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvando ? 'A criar...' : 'Criar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
