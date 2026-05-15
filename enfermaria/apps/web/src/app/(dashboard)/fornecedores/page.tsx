'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

interface Fornecedor {
  id: string;
  nome: string;
  nif?: string;
  email?: string;
  telefone?: string;
  morada?: string;
  ativo: boolean;
  _count?: { encomendas: number };
}

interface Encomenda {
  id: string;
  quantidadeEncomendada: number;
  precoUnitario?: number;
  estado: string;
  dataEntregaPrevista?: string;
  dataEntregaReal?: string;
  observacoes?: string;
  criadoEm: string;
  fornecedor: { id: string; nome: string };
  stockItem: { id: string; nome: string; unidade: string; servico: string };
  recebioPor?: { id: string; nome: string };
}

interface StockItem { id: string; nome: string; unidade: string; servico: string; }

const ESTADO_CFG: Record<string, { label: string; bg: string; text: string }> = {
  pendente:  { label: 'Pendente',  bg: 'bg-amber-50',  text: 'text-amber-700' },
  recebida:  { label: 'Recebida',  bg: 'bg-green-50',  text: 'text-green-700' },
  parcial:   { label: 'Parcial',   bg: 'bg-blue-50',   text: 'text-blue-700' },
  cancelada: { label: 'Cancelada', bg: 'bg-slate-100', text: 'text-slate-600' },
};

export default function FornecedoresPage() {
  const { utilizador } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'fornecedores' | 'encomendas'>('fornecedores');
  const [filtroEstado, setFiltroEstado] = useState('');

  // Modais
  const [modalForn, setModalForn] = useState<'criar' | 'editar' | null>(null);
  const [editForn, setEditForn] = useState<Fornecedor | null>(null);
  const [formForn, setFormForn] = useState({ nome: '', nif: '', email: '', telefone: '', morada: '' });
  const [modalEncomenda, setModalEncomenda] = useState(false);
  const [formEnc, setFormEnc] = useState({ fornecedorId: '', stockItemId: '', quantidadeEncomendada: 1, precoUnitario: '', dataEntregaPrevista: '', observacoes: '' });
  const [modalReceber, setModalReceber] = useState<Encomenda | null>(null);
  const [qtdRecebida, setQtdRecebida] = useState(0);

  const canEdit = ['farmaceutico', 'administrativo'].includes(utilizador?.role ?? '');

  const { data: fornecedores = [] } = useQuery<Fornecedor[]>({
    queryKey: ['fornecedores'],
    queryFn: () => api.get('/fornecedores').then(r => r.data ?? []),
    staleTime: 60_000,
  });

  const { data: encomendas = [], isLoading: loadingEnc } = useQuery<Encomenda[]>({
    queryKey: ['encomendas', filtroEstado],
    queryFn: () => api.get(`/fornecedores/encomendas${filtroEstado ? `?estado=${filtroEstado}` : ''}`).then(r => r.data ?? []),
    enabled: tab === 'encomendas',
    staleTime: 30_000,
  });

  const { data: stockItems = [] } = useQuery<StockItem[]>({
    queryKey: ['stock-all'],
    queryFn: () => api.get('/farmacia/stock').then(r => r.data ?? []),
    staleTime: 60_000,
    enabled: modalEncomenda,
  });

  const invalidar = () => { qc.invalidateQueries({ queryKey: ['fornecedores'] }); qc.invalidateQueries({ queryKey: ['encomendas'] }); };

  const mutCriarForn = useMutation({
    mutationFn: (body: typeof formForn) => api.post('/fornecedores', body),
    onSuccess: () => { setModalForn(null); qc.invalidateQueries({ queryKey: ['fornecedores'] }); },
  });

  const mutEditarForn = useMutation({
    mutationFn: (body: Partial<typeof formForn>) => api.patch(`/fornecedores/${editForn!.id}`, body),
    onSuccess: () => { setModalForn(null); setEditForn(null); qc.invalidateQueries({ queryKey: ['fornecedores'] }); },
  });

  const mutDesativarForn = useMutation({
    mutationFn: (id: string) => api.delete(`/fornecedores/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fornecedores'] }),
  });

  const mutCriarEncomenda = useMutation({
    mutationFn: (body: any) => api.post('/fornecedores/encomendas', { ...body, precoUnitario: body.precoUnitario ? Number(body.precoUnitario) : undefined }),
    onSuccess: () => { setModalEncomenda(false); setFormEnc({ fornecedorId: '', stockItemId: '', quantidadeEncomendada: 1, precoUnitario: '', dataEntregaPrevista: '', observacoes: '' }); invalidar(); },
  });

  const mutReceberEncomenda = useMutation({
    mutationFn: () => api.patch(`/fornecedores/encomendas/${modalReceber!.id}/receber`, { quantidadeRecebida: qtdRecebida }),
    onSuccess: () => { setModalReceber(null); setQtdRecebida(0); invalidar(); qc.invalidateQueries({ queryKey: ['farmacia'] }); },
  });

  const abrirEditarForn = (f: Fornecedor) => {
    setEditForn(f);
    setFormForn({ nome: f.nome, nif: f.nif ?? '', email: f.email ?? '', telefone: f.telefone ?? '', morada: f.morada ?? '' });
    setModalForn('editar');
  };

  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fornecedores</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Gestão de fornecedores e encomendas externas</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {tab === 'encomendas' && (
              <button onClick={() => setModalEncomenda(true)}
                className="flex items-center gap-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl transition-colors"
                style={{ padding: '10px 18px' }}>Nova Encomenda</button>
            )}
            {tab === 'fornecedores' && (
              <button onClick={() => { setFormForn({ nome: '', nif: '', email: '', telefone: '', morada: '' }); setModalForn('criar'); }}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
                style={{ padding: '10px 20px' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Novo Fornecedor
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1" style={{ marginBottom: '24px', width: 'fit-content' }}>
        {[
          { id: 'fornecedores', label: 'Fornecedores', count: fornecedores.length },
          { id: 'encomendas',   label: 'Encomendas',   count: (encomendas as Encomenda[]).filter(e => e.estado === 'pendente').length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 font-semibold text-sm rounded-lg transition-all ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            style={{ padding: '8px 16px' }}>
            {t.label}
            {t.id === 'encomendas' && t.count > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'fornecedores' ? (
        <div className="grid gap-3">
          {fornecedores.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '60px 40px' }}>
              <p className="text-slate-500">Nenhum fornecedor registado.</p>
            </div>
          ) : fornecedores.map(f => (
            <div key={f.id} className="bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-4" style={{ padding: '20px 24px' }}>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{f.nome}</p>
                <div className="flex gap-3 flex-wrap" style={{ marginTop: '4px' }}>
                  {f.nif && <span className="text-xs text-slate-400">NIF: {f.nif}</span>}
                  {f.email && <span className="text-xs text-slate-400">{f.email}</span>}
                  {f.telefone && <span className="text-xs text-slate-400">{f.telefone}</span>}
                  {f.morada && <span className="text-xs text-slate-400">{f.morada}</span>}
                </div>
                {f._count && <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>{f._count.encomendas} encomenda(s)</p>}
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button onClick={() => abrirEditarForn(f)}
                    className="text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg"
                    style={{ padding: '7px 12px' }}>Editar</button>
                  <button onClick={() => mutDesativarForn.mutate(f.id)}
                    className="text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-lg"
                    style={{ padding: '7px 12px' }}>Remover</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div>
          {/* Filtro estado */}
          <div style={{ marginBottom: '16px' }}>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              className="border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              style={{ padding: '8px 12px' }}>
              <option value="">Todos os estados</option>
              <option value="pendente">Pendente</option>
              <option value="recebida">Recebida</option>
              <option value="parcial">Parcial</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          {loadingEnc ? (
            <div className="flex justify-center" style={{ padding: '40px 0' }}>
              <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            </div>
          ) : encomendas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '60px 40px' }}>
              <p className="text-slate-500">Nenhuma encomenda registada.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {encomendas.map(e => {
                const cfg = ESTADO_CFG[e.estado] ?? ESTADO_CFG.pendente;
                return (
                  <div key={e.id} className="bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-4" style={{ padding: '20px 24px' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '4px' }}>
                        <p className="font-semibold text-slate-900 text-sm">{e.stockItem?.nome}</p>
                        <span className="text-xs text-slate-400">({e.stockItem?.servico})</span>
                      </div>
                      <p className="text-slate-500 text-xs">{e.quantidadeEncomendada} {e.stockItem?.unidade} de {e.fornecedor?.nome}{e.precoUnitario ? ` · ${e.precoUnitario.toFixed(2)}€/un` : ''}</p>
                      {e.dataEntregaPrevista && (
                        <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Entrega prevista: {new Date(e.dataEntregaPrevista).toLocaleDateString('pt-PT')}</p>
                      )}
                      {e.observacoes && <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>{e.observacoes}</p>}
                      <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                        <span className="text-xs text-slate-400">{new Date(e.criadoEm).toLocaleDateString('pt-PT')}</span>
                        {e.recebioPor && <span className="text-xs text-slate-400">Recebido por {e.recebioPor.nome}</span>}
                      </div>
                    </div>
                    {e.estado === 'pendente' && canEdit && (
                      <button onClick={() => { setModalReceber(e); setQtdRecebida(e.quantidadeEncomendada); }}
                        className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shrink-0"
                        style={{ padding: '7px 14px' }}>Receber</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Fornecedor */}
      {modalForn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">{modalForn === 'criar' ? 'Novo Fornecedor' : 'Editar Fornecedor'}</h2>
              <button onClick={() => { setModalForn(null); setEditForn(null); }} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div className="grid gap-4">
              {[
                { label: 'Nome *', key: 'nome', placeholder: 'Nome da empresa' },
                { label: 'NIF', key: 'nif', placeholder: '000000000' },
                { label: 'Email', key: 'email', placeholder: 'email@fornecedor.pt' },
                { label: 'Telefone', key: 'telefone', placeholder: '+351 000 000 000' },
                { label: 'Morada', key: 'morada', placeholder: 'Rua, Cidade' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{label}</label>
                  <input type="text" value={(formForn as any)[key]} onChange={e => setFormForn(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    style={{ padding: '10px 14px' }} placeholder={placeholder} />
                </div>
              ))}
            </div>
            <div className="flex gap-3" style={{ marginTop: '24px' }}>
              <button onClick={() => { setModalForn(null); setEditForn(null); }} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button
                onClick={() => modalForn === 'criar' ? mutCriarForn.mutate(formForn) : mutEditarForn.mutate(formForn)}
                disabled={(modalForn === 'criar' ? mutCriarForn.isPending : mutEditarForn.isPending) || !formForn.nome.trim()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {modalForn === 'criar' ? 'Criar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Encomenda */}
      {modalEncomenda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Nova Encomenda</h2>
              <button onClick={() => setModalEncomenda(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div className="grid gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Fornecedor *</label>
                <select value={formEnc.fornecedorId} onChange={e => setFormEnc(f => ({ ...f, fornecedorId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ padding: '10px 14px' }}>
                  <option value="">Seleccionar...</option>
                  {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Item de Stock *</label>
                <select value={formEnc.stockItemId} onChange={e => setFormEnc(f => ({ ...f, stockItemId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ padding: '10px 14px' }}>
                  <option value="">Seleccionar...</option>
                  {stockItems.map(s => <option key={s.id} value={s.id}>{s.nome} ({s.servico})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Quantidade *</label>
                  <input type="number" value={formEnc.quantidadeEncomendada} onChange={e => setFormEnc(f => ({ ...f, quantidadeEncomendada: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    style={{ padding: '10px 14px' }} min={1} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Preço unit. (€)</label>
                  <input type="number" value={formEnc.precoUnitario} onChange={e => setFormEnc(f => ({ ...f, precoUnitario: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    style={{ padding: '10px 14px' }} min={0} step="0.01" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Data de entrega prevista</label>
                <input type="date" value={formEnc.dataEntregaPrevista} onChange={e => setFormEnc(f => ({ ...f, dataEntregaPrevista: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ padding: '10px 14px' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Observações</label>
                <textarea value={formEnc.observacoes} onChange={e => setFormEnc(f => ({ ...f, observacoes: e.target.value }))}
                  rows={2} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  style={{ padding: '10px 14px' }} />
              </div>
            </div>
            <div className="flex gap-3" style={{ marginTop: '24px' }}>
              <button onClick={() => setModalEncomenda(false)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => mutCriarEncomenda.mutate(formEnc)}
                disabled={mutCriarEncomenda.isPending || !formEnc.fornecedorId || !formEnc.stockItemId}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {mutCriarEncomenda.isPending ? 'A criar...' : 'Criar Encomenda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Receber Encomenda */}
      {modalReceber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '400px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">Receber Encomenda</h2>
              <button onClick={() => setModalReceber(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-slate-600 text-sm" style={{ marginBottom: '4px' }}>{modalReceber.stockItem?.nome}</p>
            <p className="text-slate-400 text-xs" style={{ marginBottom: '20px' }}>Encomendado: {modalReceber.quantidadeEncomendada} {modalReceber.stockItem?.unidade}</p>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Quantidade efectivamente recebida *</label>
              <input type="number" value={qtdRecebida} onChange={e => setQtdRecebida(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '10px 14px' }} min={1} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalReceber(null)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => mutReceberEncomenda.mutate()} disabled={mutReceberEncomenda.isPending || qtdRecebida <= 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {mutReceberEncomenda.isPending ? 'A registar...' : 'Confirmar Recepção'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
