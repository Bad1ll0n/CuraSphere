'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

interface Doente { id: string; nome: string; numeroProcesso: string; }
interface ItemFatura { id: string; descricao: string; categoria: string; quantidade: number; precoUnitario: number; total: number; }
interface Pagamento { id: string; valor: number; metodo: string; referencia?: string; criadoEm: string; registadoPor: { nome: string }; }
interface Episodio {
  id: string; estado: string; totalBase: number; totalCobrado: number;
  tipoCobertura?: string; notas?: string; criadoEm: string; dataEmissao?: string;
  doente: Doente;
  criadoPor: { nome: string };
  itens?: ItemFatura[];
  pagamentos?: Pagamento[];
  _count?: { itens: number; pagamentos: number };
}

const estadoCor: Record<string, string> = {
  pendente:  'bg-amber-100 text-amber-700 border border-amber-200',
  emitida:   'bg-blue-100 text-blue-700 border border-blue-200',
  paga:      'bg-emerald-100 text-emerald-700 border border-emerald-200',
  isenta:    'bg-slate-100 text-slate-600 border border-slate-200',
  anulada:   'bg-red-100 text-red-600 border border-red-200',
};

const estadoLabel: Record<string, string> = {
  pendente: 'Pendente', emitida: 'Emitida', paga: 'Paga', isenta: 'Isenta', anulada: 'Anulada',
};

const categoriaLabel: Record<string, string> = {
  diaria: 'Diária', procedimento: 'Procedimento', medicacao: 'Medicação', exame: 'Exame', outro: 'Outro',
};

const metodoLabel: Record<string, string> = {
  numerario: 'Numerário', multibanco: 'Multibanco', transferencia: 'Transferência', seguro: 'Seguro', isencao: 'Isenção',
};

export default function FaturacaoPage() {
  const { utilizador } = useAuth();
  const [episodios, setEpisodios] = useState<Episodio[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [loading, setLoading] = useState(true);
  const [detalhe, setDetalhe] = useState<Episodio | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  // Modal criar episódio
  const [modalCriar, setModalCriar] = useState(false);
  const [doentes, setDoentes] = useState<Doente[]>([]);
  const [novoDoenteId, setNovoDoenteId] = useState('');
  const [novoTipo, setNovoTipo] = useState('');
  const [novoNotas, setNovoNotas] = useState('');
  const [criando, setCriando] = useState(false);

  // Modal adicionar item
  const [modalItem, setModalItem] = useState(false);
  const [novoItem, setNovoItem] = useState({ descricao: '', categoria: 'diaria', quantidade: 1, precoUnitario: 0 });
  const [adicionandoItem, setAdicionandoItem] = useState(false);

  // Modal pagamento
  const [modalPagamento, setModalPagamento] = useState(false);
  const [novoPagamento, setNovoPagamento] = useState({ valor: 0, metodo: 'multibanco', referencia: '' });
  const [registandoPagamento, setRegistandoPagamento] = useState(false);

  const podeVer = utilizador?.role === 'administrativo';
  const [resumo, setResumo] = useState<{ totalFaturado: number; totalPago: number; totalPendente: number; totalAnulado: number } | null>(null);

  const carregarResumo = async () => {
    try {
      const r = await api.get('/faturacao/resumo');
      setResumo(r.data);
    } catch { /* silencioso */ }
  };

  const carregar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filtroEstado) params.set('estado', filtroEstado);
      const r = await api.get(`/faturacao?${params}`);
      setEpisodios(r.data.data);
      setTotal(r.data.total);
    } catch { /* silencioso */ } finally { setLoading(false); }
  };

  useEffect(() => { if (podeVer) { carregar(); carregarResumo(); } }, [page, filtroEstado]);
  useEffect(() => { if (podeVer) carregarResumo(); }, []);

  const abrirDetalhe = async (ep: Episodio) => {
    setLoadingDetalhe(true);
    setDetalhe(ep);
    try {
      const r = await api.get(`/faturacao/${ep.id}`);
      setDetalhe(r.data);
    } catch { /* silencioso */ } finally { setLoadingDetalhe(false); }
  };

  const criarEpisodio = async () => {
    if (!novoDoenteId) return;
    setCriando(true);
    try {
      await api.post('/faturacao', { doenteId: novoDoenteId, tipoCobertura: novoTipo || undefined, notas: novoNotas || undefined });
      setModalCriar(false); setNovoDoenteId(''); setNovoTipo(''); setNovoNotas('');
      await carregar();
    } catch { /* silencioso */ } finally { setCriando(false); }
  };

  const abrirModalCriar = async () => {
    setModalCriar(true);
    if (doentes.length === 0) {
      const r = await api.get('/doentes?todos=true&limit=200');
      setDoentes(r.data.data ?? r.data);
    }
  };

  const adicionarItem = async () => {
    if (!detalhe) return;
    setAdicionandoItem(true);
    try {
      await api.post(`/faturacao/${detalhe.id}/itens`, novoItem);
      setModalItem(false);
      setNovoItem({ descricao: '', categoria: 'diaria', quantidade: 1, precoUnitario: 0 });
      const r = await api.get(`/faturacao/${detalhe.id}`);
      setDetalhe(r.data);
      await carregar();
    } catch { /* silencioso */ } finally { setAdicionandoItem(false); }
  };

  const removerItem = async (itemId: string) => {
    if (!detalhe || !confirm('Remover item?')) return;
    await api.delete(`/faturacao/${detalhe.id}/itens/${itemId}`);
    const r = await api.get(`/faturacao/${detalhe.id}`);
    setDetalhe(r.data); await carregar();
  };

  const registarPagamento = async () => {
    if (!detalhe) return;
    setRegistandoPagamento(true);
    try {
      await api.post(`/faturacao/${detalhe.id}/pagamento`, {
        valor: novoPagamento.valor,
        metodo: novoPagamento.metodo,
        referencia: novoPagamento.referencia || undefined,
      });
      setModalPagamento(false);
      setNovoPagamento({ valor: 0, metodo: 'multibanco', referencia: '' });
      const r = await api.get(`/faturacao/${detalhe.id}`);
      setDetalhe(r.data); await carregar();
    } catch { /* silencioso */ } finally { setRegistandoPagamento(false); }
  };

  const emitir = async () => {
    if (!detalhe) return;
    await api.patch(`/faturacao/${detalhe.id}/estado`, { estado: 'emitida' });
    const r = await api.get(`/faturacao/${detalhe.id}`);
    setDetalhe(r.data); await carregar();
  };

  const anular = async () => {
    if (!detalhe || !confirm('Anular episódio?')) return;
    await api.patch(`/faturacao/${detalhe.id}/estado`, { estado: 'anulada' });
    const r = await api.get(`/faturacao/${detalhe.id}`);
    setDetalhe(r.data); await carregar();
  };

  if (!podeVer) {
    return (
      <div style={{ padding: '40px 48px' }}>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3" style={{ padding: '20px 24px' }}>
          <p className="text-amber-700 text-sm font-medium">Acesso restrito a utilizadores administrativos.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Faturação</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>{total} episódios</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none shadow-sm"
            style={{ padding: '10px 14px' }}>
            <option value="">Todos os estados</option>
            {Object.entries(estadoLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={abrirModalCriar}
            className="bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
            style={{ padding: '10px 18px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Episódio
          </button>
        </div>
      </div>

      {/* Resumo financeiro */}
      {resumo && (
        <div className="grid grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
          {[
            { label: 'Total Faturado', value: resumo.totalFaturado, cor: 'text-slate-800', bg: 'bg-slate-50', borda: 'border-slate-200' },
            { label: 'Pago',           value: resumo.totalPago,     cor: 'text-emerald-700', bg: 'bg-emerald-50', borda: 'border-emerald-200' },
            { label: 'Pendente',       value: resumo.totalPendente, cor: 'text-amber-700', bg: 'bg-amber-50', borda: 'border-amber-200' },
            { label: 'Anulado',        value: resumo.totalAnulado,  cor: 'text-red-600', bg: 'bg-red-50', borda: 'border-red-200' },
          ].map(k => (
            <div key={k.label} className={`rounded-2xl border ${k.bg} ${k.borda}`} style={{ padding: '18px 20px' }}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{k.label}</p>
              <p className={`text-2xl font-bold ${k.cor}`} style={{ marginTop: '4px' }}>
                {k.value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-slate-400 text-sm text-center" style={{ paddingTop: '60px' }}>A carregar...</div>
      ) : episodios.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-slate-400" style={{ padding: '80px' }}>
          <p className="text-sm font-medium">Sem episódios de faturação</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Doente', 'Processo', 'Cobertura', 'Total', 'Estado', 'Criado em', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ padding: '14px 20px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {episodios.map((ep, i) => (
                <tr key={ep.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => abrirDetalhe(ep)}
                  style={{ borderBottom: i < episodios.length - 1 ? undefined : 'none' }}>
                  <td style={{ padding: '16px 20px' }}>
                    <p className="font-medium text-slate-800">{ep.doente.nome}</p>
                    <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>por {ep.criadoPor.nome}</p>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{ep.doente.numeroProcesso}</span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span className="text-xs text-slate-500 capitalize">{ep.tipoCobertura ?? '—'}</span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span className="font-semibold text-slate-800">{ep.totalCobrado.toFixed(2)} €</span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${estadoCor[ep.estado]}`}>{estadoLabel[ep.estado]}</span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span className="text-xs text-slate-400">{new Date(ep.criadoEm).toLocaleDateString('pt-PT')}</span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > 20 && (
            <div className="flex items-center justify-between border-t border-slate-100" style={{ padding: '14px 20px' }}>
              <span className="text-xs text-slate-400">{total} episódios no total</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50">Anterior</button>
                <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50">Seguinte</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Detalhe */}
      {detalhe && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col" style={{ maxWidth: '680px', maxHeight: '90vh', overflow: 'hidden' }}>
            <div className="flex items-start justify-between border-b border-slate-100" style={{ padding: '24px 28px' }}>
              <div>
                <div className="flex items-center gap-3" style={{ marginBottom: '4px' }}>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${estadoCor[detalhe.estado]}`}>{estadoLabel[detalhe.estado]}</span>
                  {detalhe.tipoCobertura && <span className="text-xs text-slate-400 capitalize">{detalhe.tipoCobertura}</span>}
                </div>
                <h2 className="text-xl font-bold text-slate-900">{detalhe.doente.nome}</h2>
                <p className="text-sm text-slate-400" style={{ marginTop: '2px' }}>Processo: {detalhe.doente.numeroProcesso}</p>
              </div>
              <button onClick={() => setDetalhe(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '24px 28px', flex: 1 }}>
              {loadingDetalhe ? (
                <p className="text-slate-400 text-sm text-center" style={{ paddingTop: '20px' }}>A carregar...</p>
              ) : (
                <>
                  {/* Total */}
                  <div className="grid grid-cols-3 gap-4" style={{ marginBottom: '24px' }}>
                    {[
                      { label: 'Total Base', valor: `${detalhe.totalBase.toFixed(2)} €` },
                      { label: 'Total a Cobrar', valor: `${detalhe.totalCobrado.toFixed(2)} €` },
                      { label: 'Total Pago', valor: `${(detalhe.pagamentos ?? []).reduce((s, p) => s + p.valor, 0).toFixed(2)} €` },
                    ].map(({ label, valor }) => (
                      <div key={label} className="bg-slate-50 rounded-xl text-center" style={{ padding: '14px' }}>
                        <p className="text-xs text-slate-400" style={{ marginBottom: '4px' }}>{label}</p>
                        <p className="text-lg font-bold text-slate-800">{valor}</p>
                      </div>
                    ))}
                  </div>

                  {/* Itens */}
                  <div style={{ marginBottom: '24px' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                      <h3 className="text-sm font-semibold text-slate-700">Itens da Fatura</h3>
                      {detalhe.estado !== 'paga' && detalhe.estado !== 'anulada' && (
                        <button onClick={() => setModalItem(true)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Adicionar Item
                        </button>
                      )}
                    </div>
                    {(detalhe.itens ?? []).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem itens</p>
                    ) : (
                      <div className="border border-slate-100 rounded-xl overflow-hidden">
                        {detalhe.itens!.map((item, i) => (
                          <div key={item.id} className="flex items-center gap-3 hover:bg-slate-50"
                            style={{ padding: '12px 16px', borderBottom: i < detalhe.itens!.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-800">{item.descricao}</p>
                              <p className="text-xs text-slate-400">{categoriaLabel[item.categoria]} · {item.quantidade}x · {item.precoUnitario.toFixed(2)} €</p>
                            </div>
                            <span className="text-sm font-semibold text-slate-700">{item.total.toFixed(2)} €</span>
                            {detalhe.estado !== 'paga' && detalhe.estado !== 'anulada' && (
                              <button onClick={() => removerItem(item.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pagamentos */}
                  <div style={{ marginBottom: '24px' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                      <h3 className="text-sm font-semibold text-slate-700">Pagamentos</h3>
                      {detalhe.estado !== 'anulada' && detalhe.estado !== 'paga' && (
                        <button onClick={() => setModalPagamento(true)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Registar Pagamento
                        </button>
                      )}
                    </div>
                    {(detalhe.pagamentos ?? []).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem pagamentos registados</p>
                    ) : (
                      <div className="border border-slate-100 rounded-xl overflow-hidden">
                        {detalhe.pagamentos!.map((pag, i) => (
                          <div key={pag.id} className="flex items-center gap-3"
                            style={{ padding: '12px 16px', borderBottom: i < detalhe.pagamentos!.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-800">{metodoLabel[pag.metodo]}</p>
                              <p className="text-xs text-slate-400">
                                {pag.registadoPor.nome} · {new Date(pag.criadoEm).toLocaleDateString('pt-PT')}
                                {pag.referencia && ` · ${pag.referencia}`}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-emerald-600">+{pag.valor.toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Acções */}
            <div className="flex gap-3 border-t border-slate-100" style={{ padding: '16px 28px' }}>
              {detalhe.estado === 'pendente' && (
                <button onClick={emitir}
                  className="bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                  style={{ padding: '10px 20px' }}>
                  Emitir Fatura
                </button>
              )}
              {['pendente', 'emitida'].includes(detalhe.estado) && (
                <button onClick={anular}
                  className="border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium rounded-xl transition-colors"
                  style={{ padding: '10px 20px' }}>
                  Anular
                </button>
              )}
              <button onClick={() => setDetalhe(null)}
                className="ml-auto border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '10px 20px' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Episódio */}
      {modalCriar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px' }}>
            <h2 className="text-xl font-bold text-slate-900" style={{ marginBottom: '24px' }}>Novo Episódio de Faturação</h2>

            <div style={{ marginBottom: '16px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Doente</label>
              <select value={novoDoenteId} onChange={e => setNovoDoenteId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                style={{ padding: '10px 14px' }}>
                <option value="">Selecionar doente...</option>
                {doentes.map(d => <option key={d.id} value={d.id}>{d.nome} ({d.numeroProcesso})</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Tipo de Cobertura</label>
              <select value={novoTipo} onChange={e => setNovoTipo(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none"
                style={{ padding: '10px 14px' }}>
                <option value="">Não definido</option>
                <option value="sns">SNS</option>
                <option value="seguro">Seguro</option>
                <option value="particular">Particular</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Notas</label>
              <textarea value={novoNotas} onChange={e => setNovoNotas(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none resize-none"
                style={{ padding: '10px 14px' }} rows={2} placeholder="Observações..." />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalCriar(false)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={criarEpisodio} disabled={!novoDoenteId || criando}
                className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors"
                style={{ padding: '11px' }}>{criando ? 'A criar...' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Item */}
      {modalItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '420px', padding: '32px' }}>
            <h2 className="text-xl font-bold text-slate-900" style={{ marginBottom: '24px' }}>Adicionar Item</h2>

            {[
              { label: 'Descrição', node: <input value={novoItem.descricao} onChange={e => setNovoItem(p => ({ ...p, descricao: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none" style={{ padding: '10px 14px' }} placeholder="Ex: Diária de internamento" /> },
              { label: 'Categoria', node: <select value={novoItem.categoria} onChange={e => setNovoItem(p => ({ ...p, categoria: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none" style={{ padding: '10px 14px' }}>
                  {Object.entries(categoriaLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select> },
              { label: 'Quantidade', node: <input type="number" min={1} value={novoItem.quantidade} onChange={e => setNovoItem(p => ({ ...p, quantidade: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none" style={{ padding: '10px 14px' }} /> },
              { label: 'Preço Unitário (€)', node: <input type="number" min={0} step={0.01} value={novoItem.precoUnitario} onChange={e => setNovoItem(p => ({ ...p, precoUnitario: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none" style={{ padding: '10px 14px' }} /> },
            ].map(({ label, node }) => (
              <div key={label} style={{ marginBottom: '16px' }}>
                <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>{label}</label>
                {node}
              </div>
            ))}

            <div className="bg-slate-50 rounded-xl text-center" style={{ padding: '12px', marginBottom: '20px' }}>
              <p className="text-xs text-slate-400">Total</p>
              <p className="text-lg font-bold text-slate-800">{(novoItem.quantidade * novoItem.precoUnitario).toFixed(2)} €</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalItem(false)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={adicionarItem} disabled={!novoItem.descricao || adicionandoItem}
                className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60"
                style={{ padding: '11px' }}>{adicionandoItem ? 'A adicionar...' : 'Adicionar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registar Pagamento */}
      {modalPagamento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '400px', padding: '32px' }}>
            <h2 className="text-xl font-bold text-slate-900" style={{ marginBottom: '24px' }}>Registar Pagamento</h2>

            <div style={{ marginBottom: '16px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Valor (€)</label>
              <input type="number" min={0} step={0.01} value={novoPagamento.valor} onChange={e => setNovoPagamento(p => ({ ...p, valor: +e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none" style={{ padding: '10px 14px' }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Método</label>
              <select value={novoPagamento.metodo} onChange={e => setNovoPagamento(p => ({ ...p, metodo: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none" style={{ padding: '10px 14px' }}>
                {Object.entries(metodoLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="block text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Referência</label>
              <input value={novoPagamento.referencia} onChange={e => setNovoPagamento(p => ({ ...p, referencia: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none" style={{ padding: '10px 14px' }}
                placeholder="Nº transação, comprovativo..." />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalPagamento(false)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={registarPagamento} disabled={novoPagamento.valor <= 0 || registandoPagamento}
                className="flex-1 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-60"
                style={{ padding: '11px' }}>{registandoPagamento ? 'A registar...' : 'Registar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
