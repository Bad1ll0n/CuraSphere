'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface Registo {
  id: string;
  tipo: 'entrada' | 'saida';
  categoria: string;
  quantidade: number;
  descricao?: string;
  data: string;
  registadoPor: { id: string; nome: string };
}

interface Resumo {
  entradas: number;
  saidas: number;
  balanco: number;
  porCategoria: Record<string, number>;
}

interface HistoricoItem {
  data: string;
  entradas: number;
  saidas: number;
  balanco: number;
}

const CATEGORIAS_ENTRADA = ['soro_iv', 'oral', 'enteral', 'outro'];
const CATEGORIAS_SAIDA = ['urina', 'dreno', 'vomito', 'fezes', 'aspiracao', 'outro'];

const LABEL_CATEGORIA: Record<string, string> = {
  soro_iv: 'Soro IV', oral: 'Oral', enteral: 'Enteral',
  urina: 'Urina', dreno: 'Dreno', vomito: 'Vómito',
  fezes: 'Fezes', aspiracao: 'Aspiração', outro: 'Outro',
};

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>('button, input, select, textarea')?.focus();
    return () => prev?.focus();
  }, []);
  useEffect(() => {
    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="bh-modal-titulo"
        className="bg-white rounded-2xl shadow-2xl w-full"
        style={{ maxWidth: '440px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h2 id="bh-modal-titulo" className="text-xl font-bold text-slate-900">{titulo}</h2>
          <button onClick={onClose} aria-label="Fechar modal"
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string; nome?: string } | null;
}

export function BalancoHidricoPanel({ doenteId, utilizador }: Props) {
  const toast = useToast();
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0]);
  const [registos, setRegistos] = useState<Registo[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [categoria, setCategoria] = useState('soro_iv');
  const [quantidade, setQuantidade] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  const canEdit = utilizador && ['medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'chefe_turno', 'chefe_enfermeiros'].includes(utilizador.role);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [diaRes, histRes] = await Promise.all([
        api.get(`/balanco-hidrico/${doenteId}?data=${data}`),
        api.get(`/balanco-hidrico/${doenteId}/historico?dias=7`),
      ]);
      setRegistos(diaRes.data.registos ?? []);
      setResumo(diaRes.data.resumo ?? null);
      setHistorico(histRes.data ?? []);
    } catch {
      toast.error('Erro ao carregar balanço hídrico');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doenteId, data]);

  useEffect(() => { carregar(); }, [carregar]);

  const mudarDia = (delta: number) => {
    const d = new Date(data);
    d.setDate(d.getDate() + delta);
    setData(d.toISOString().split('T')[0]);
  };

  const abrirModal = () => {
    setTipo('entrada');
    setCategoria('soro_iv');
    setQuantidade('');
    setDescricao('');
    setShowModal(true);
  };

  const handleTipoChange = (t: 'entrada' | 'saida') => {
    setTipo(t);
    setCategoria(t === 'entrada' ? 'soro_iv' : 'urina');
  };

  const guardar = async () => {
    const qt = parseInt(quantidade, 10);
    if (!qt || qt < 1) { toast.error('Quantidade inválida'); return; }
    setSaving(true);
    try {
      await api.post(`/balanco-hidrico/${doenteId}`, { tipo, categoria, quantidade: qt, descricao: descricao || undefined });
      toast.success('Registo guardado');
      setShowModal(false);
      carregar();
    } catch {
      toast.error('Erro ao guardar registo');
    } finally {
      setSaving(false);
    }
  };

  const apagar = async (id: string) => {
    try {
      await api.delete(`/balanco-hidrico/${id}`);
      toast.success('Registo apagado');
      carregar();
    } catch {
      toast.error('Erro ao apagar registo');
    }
  };

  const balancoCor = resumo ? (resumo.balanco >= 0 ? '#3b82f6' : '#f97316') : '#3b82f6';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
        <h3 className="text-base font-semibold text-slate-900">Balanço Hídrico</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => mudarDia(-1)}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            ‹
          </button>
          <span className="text-sm font-medium text-slate-700">
            {new Date(data + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
          <button onClick={() => mudarDia(1)}
            disabled={data >= new Date().toISOString().split('T')[0]}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30">
            ›
          </button>
          {canEdit && (
            <button onClick={abrirModal}
              className="flex items-center gap-1 px-3 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
              style={{ marginLeft: '8px' }}>
              + Registar
            </button>
          )}
        </div>
      </div>

      {/* Cards de resumo */}
      {resumo && (
        <div className="grid grid-cols-3 gap-3" style={{ marginBottom: '20px' }}>
          <div className="rounded-xl p-3 text-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <p className="text-xs font-medium text-green-700" style={{ marginBottom: '4px' }}>Entradas</p>
            <p className="text-2xl font-bold text-green-800">{resumo.entradas}</p>
            <p className="text-xs text-green-600">mL</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: '#fff1f2', border: '1px solid #fecdd3' }}>
            <p className="text-xs font-medium text-red-700" style={{ marginBottom: '4px' }}>Saídas</p>
            <p className="text-2xl font-bold text-red-800">{resumo.saidas}</p>
            <p className="text-xs text-red-600">mL</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: resumo.balanco >= 0 ? '#eff6ff' : '#fff7ed', border: `1px solid ${resumo.balanco >= 0 ? '#bfdbfe' : '#fed7aa'}` }}>
            <p className="text-xs font-medium" style={{ color: balancoCor, marginBottom: '4px' }}>Balanço</p>
            <p className="text-2xl font-bold" style={{ color: balancoCor }}>
              {resumo.balanco >= 0 ? '+' : ''}{resumo.balanco}
            </p>
            <p className="text-xs" style={{ color: balancoCor }}>mL</p>
          </div>
        </div>
      )}

      {/* Tabela de registos */}
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-4">A carregar...</p>
      ) : registos.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">Sem registos para este dia</p>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #e2e8f0', marginBottom: '20px' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid #e2e8f0' }}>
                <th className="text-left text-xs font-semibold text-slate-500 py-2 px-3">Hora</th>
                <th className="text-left text-xs font-semibold text-slate-500 py-2 px-3">Tipo</th>
                <th className="text-left text-xs font-semibold text-slate-500 py-2 px-3">Categoria</th>
                <th className="text-right text-xs font-semibold text-slate-500 py-2 px-3">Qtd (mL)</th>
                <th className="text-left text-xs font-semibold text-slate-500 py-2 px-3">Por</th>
                {canEdit && <th className="py-2 px-3" />}
              </tr>
            </thead>
            <tbody>
              {registos.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < registos.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <td className="py-2 px-3 text-slate-600">{formatHora(r.data)}</td>
                  <td className="py-2 px-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${r.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {r.tipo === 'entrada' ? '↑' : '↓'} {r.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-600">{LABEL_CATEGORIA[r.categoria] ?? r.categoria}</td>
                  <td className="py-2 px-3 text-right font-semibold text-slate-800">{r.quantidade}</td>
                  <td className="py-2 px-3 text-slate-500 text-xs">{r.registadoPor?.nome}</td>
                  {canEdit && (
                    <td className="py-2 px-3">
                      {r.registadoPor?.id === utilizador?.id && (
                        <button onClick={() => apagar(r.id)}
                          className="text-slate-300 hover:text-red-400 transition-colors"
                          aria-label="Apagar registo">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Gráfico histórico 7 dias */}
      {historico.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <p className="text-xs font-semibold text-slate-500" style={{ marginBottom: '8px' }}>Últimos 7 dias</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={historico} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="data" tickFormatter={formatData} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any, name: any) => [`${v} mL`, name === 'entradas' ? 'Entradas' : 'Saídas']} labelFormatter={(iso: any) => formatData(iso)} />
              <Legend formatter={(v) => v === 'entradas' ? 'Entradas' : 'Saídas'} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="entradas" stackId="a" fill="#34d399" name="entradas" radius={[0, 0, 0, 0]} />
              <Bar dataKey="saidas" stackId="b" fill="#f87171" name="saidas" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Modal registar */}
      {showModal && (
        <Modal titulo="Registar Entrada/Saída" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-slate-700" style={{ marginBottom: '8px' }}>Tipo</label>
              <div className="flex gap-2">
                {(['entrada', 'saida'] as const).map((t) => (
                  <button key={t} onClick={() => handleTipoChange(t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tipo === t
                      ? t === 'entrada' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {t === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                  </button>
                ))}
              </div>
            </div>

            {/* Categoria */}
            <div>
              <label className="block text-sm font-medium text-slate-700" style={{ marginBottom: '8px' }}>Categoria</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {(tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA).map((c) => (
                  <option key={c} value={c}>{LABEL_CATEGORIA[c]}</option>
                ))}
              </select>
            </div>

            {/* Quantidade */}
            <div>
              <label className="block text-sm font-medium text-slate-700" style={{ marginBottom: '8px' }}>Quantidade (mL)</label>
              <input type="number" min={1} max={10000} value={quantidade} onChange={(e) => setQuantidade(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 500" />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-slate-700" style={{ marginBottom: '8px' }}>Descrição (opcional)</label>
              <input type="text" maxLength={200} value={descricao} onChange={(e) => setDescricao(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: NaCl 0.9% 500mL a 125mL/h" />
            </div>

            <div className="flex gap-3" style={{ marginTop: '8px' }}>
              <button onClick={() => setShowModal(false)} disabled={saving}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={guardar} disabled={saving || !quantidade}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
