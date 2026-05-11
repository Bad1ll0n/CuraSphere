'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

interface StockItem {
  id: string;
  nome: string;
  tipo: string;
  quantidade: number;
  quantidadeMinima: number;
  unidade: string;
  validade?: string;
  servico: string;
}

interface PedidoFarmacia {
  id: string;
  quantidade: number;
  servico: string;
  estado: string;
  observacoes?: string;
  criadoEm: string;
  stockItem: { id: string; nome: string; unidade: string };
  solicitadoPor: { id: string; nome: string };
  processadoPor?: { id: string; nome: string };
}

const ESTADO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pendente:    { label: 'Pendente',   bg: 'bg-amber-50',  text: 'text-amber-700' },
  aprovado:    { label: 'Aprovado',   bg: 'bg-blue-50',   text: 'text-blue-700' },
  dispensado:  { label: 'Dispensado', bg: 'bg-green-50',  text: 'text-green-700' },
  cancelado:   { label: 'Cancelado',  bg: 'bg-slate-100', text: 'text-slate-600' },
};

const TIPO_LABELS: Record<string, string> = {
  medicamento: 'Medicamento',
  material:    'Material',
  consumivel:  'Consumível',
};

interface PrescricaoPendente {
  id: string;
  nome: string;
  dose: string;
  via: string;
  frequencia: string;
  iniciadoEm: string;
  doente: { id: string; nome: string; cama: { numero: string; quarto: string } };
  prescritoPor: { nome: string; role: string };
}

export default function FarmaciaPage() {
  const { utilizador } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'stock' | 'pedidos' | 'alertas' | 'validacao'>('stock');
  const [pedidoModal, setPedidoModal] = useState<StockItem | null>(null);
  const [pedidoForm, setPedidoForm] = useState({ quantidade: 1, observacoes: '' });
  const [novoItemModal, setNovoItemModal] = useState(false);
  const [novoItemForm, setNovoItemForm] = useState({ nome: '', tipo: 'medicamento', quantidade: 0, quantidadeMinima: 5, unidade: 'unidades', servico: utilizador?.servico ?? 'farmacia' });
  const [modalRejeitar, setModalRejeitar] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');

  const isFarmaceutico = utilizador?.role === 'farmaceutico';
  const isFarmacia = ['farmaceutico', 'tecnico_farmacia'].includes(utilizador?.role ?? '');

  const { data = {}, isLoading: loading } = useQuery({
    queryKey: ['farmacia', isFarmaceutico],
    queryFn: async () => {
      const requests: Promise<any>[] = [
        api.get('/farmacia/stock'),
        api.get('/farmacia/pedidos'),
        api.get('/farmacia/alertas'),
      ];
      if (isFarmaceutico) requests.push(api.get('/medicacao/pendentes-validacao'));
      const [s, p, a, presc] = await Promise.all(requests);
      return { stock: s.data ?? [], pedidos: p.data ?? [], alertas: a.data ?? [], prescricoes: presc?.data ?? [] };
    },
    staleTime: 30_000,
  });

  const stock: StockItem[] = (data as any).stock ?? [];
  const pedidos: PedidoFarmacia[] = (data as any).pedidos ?? [];
  const alertas: StockItem[] = (data as any).alertas ?? [];
  const prescricoes: PrescricaoPendente[] = (data as any).prescricoes ?? [];
  const invalidar = () => qc.invalidateQueries({ queryKey: ['farmacia'] });

  const mutPedido = useMutation({
    mutationFn: (body: { stockItemId: string; quantidade: number; observacoes: string }) => api.post('/farmacia/pedido', body),
    onSuccess: () => { setPedidoModal(null); setPedidoForm({ quantidade: 1, observacoes: '' }); invalidar(); },
  });

  const mutDispensar = useMutation({
    mutationFn: (id: string) => api.patch(`/farmacia/pedido/${id}/dispensar`),
    onSuccess: invalidar,
  });

  const mutNovoItem = useMutation({
    mutationFn: (body: typeof novoItemForm) => api.post('/farmacia/stock', body),
    onSuccess: () => { setNovoItemModal(false); invalidar(); },
  });

  const mutValidar = useMutation({
    mutationFn: (id: string) => api.patch(`/medicacao/${id}/validar`),
    onSuccess: invalidar,
  });

  const mutRejeitar = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => api.patch(`/medicacao/${id}/rejeitar`, { motivoRejeicao: motivo }),
    onSuccess: () => { setModalRejeitar(null); setMotivoRejeicao(''); invalidar(); },
  });

  const TABS: { id: string; label: string; count: number }[] = [
    { id: 'stock',     label: 'Stock',      count: stock.length },
    { id: 'pedidos',   label: 'Pedidos',    count: pedidos.filter(p => p.estado === 'pendente').length },
    { id: 'alertas',   label: 'Alertas',    count: alertas.length },
    ...(isFarmaceutico ? [{ id: 'validacao', label: 'Validação', count: prescricoes.length }] : []),
  ];

  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Farmácia</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Gestão de stock e pedidos de reposição</p>
        </div>
        {isFarmacia && (
          <button onClick={() => setNovoItemModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
            style={{ padding: '10px 20px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Item
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1" style={{ marginBottom: '24px', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 font-semibold text-sm rounded-lg transition-all ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            style={{ padding: '8px 16px' }}>
            {t.label}
            {t.id === 'alertas' && t.count > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{t.count}</span>
            )}
            {t.id === 'pedidos' && t.count > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{t.count}</span>
            )}
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
      ) : tab === 'stock' ? (
        <div className="grid gap-3">
          {stock.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '60px 40px' }}>
              <p className="text-slate-500">Nenhum item em stock registado.</p>
            </div>
          ) : stock.map(item => {
            const baixo = item.quantidade <= item.quantidadeMinima;
            return (
              <div key={item.id} className={`bg-white rounded-2xl border flex items-center justify-between gap-4 ${baixo ? 'border-red-200' : 'border-slate-200'}`} style={{ padding: '20px 24px' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                    <p className="font-semibold text-slate-900 text-sm">{item.nome}</p>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{TIPO_LABELS[item.tipo] ?? item.tipo}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${baixo ? 'text-red-600' : 'text-slate-700'}`}>
                      {item.quantidade} {item.unidade}
                    </span>
                    <span className="text-xs text-slate-400">mín: {item.quantidadeMinima} {item.unidade}</span>
                    {item.validade && (
                      <span className="text-xs text-slate-400">val: {new Date(item.validade).toLocaleDateString('pt-PT')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {baixo && <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">Stock baixo</span>}
                  <button onClick={() => { setPedidoModal(item); setPedidoForm({ quantidade: 1, observacoes: '' }); }}
                    className="text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    style={{ padding: '7px 14px' }}>
                    Pedir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : tab === 'pedidos' ? (
        <div className="grid gap-3">
          {pedidos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '60px 40px' }}>
              <p className="text-slate-500">Nenhum pedido registado.</p>
            </div>
          ) : pedidos.map(p => {
            const cfg = ESTADO_CONFIG[p.estado] ?? ESTADO_CONFIG.pendente;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-4" style={{ padding: '20px 24px' }}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">{p.stockItem?.nome}</p>
                  <p className="text-slate-500 text-xs" style={{ marginTop: '2px' }}>
                    {p.quantidade} {p.stockItem?.unidade} — Pedido por {p.solicitadoPor?.nome}
                  </p>
                  <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    <span className="text-xs text-slate-400">{new Date(p.criadoEm).toLocaleDateString('pt-PT')}</span>
                  </div>
                </div>
                {p.estado === 'pendente' && isFarmacia && (
                  <button onClick={() => mutDispensar.mutate(p.id)}
                    className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shrink-0"
                    style={{ padding: '7px 14px' }}>
                    Dispensar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-3">
          {alertas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '60px 40px' }}>
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto" style={{ marginBottom: '12px' }}>
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-700 font-semibold">Sem alertas</p>
              <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>Todo o stock está dentro dos níveis mínimos.</p>
            </div>
          ) : alertas.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-red-200 flex items-center justify-between gap-4" style={{ padding: '20px 24px' }}>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{item.nome}</p>
                <p className="text-red-600 text-sm font-medium" style={{ marginTop: '2px' }}>
                  {item.quantidade} {item.unidade} (mínimo: {item.quantidadeMinima})
                </p>
              </div>
              <button onClick={() => { setPedidoModal(item); setPedidoForm({ quantidade: item.quantidadeMinima - item.quantidade, observacoes: '' }); }}
                className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shrink-0"
                style={{ padding: '7px 14px' }}>
                Repor
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'validacao' && (
        <div className="grid gap-3">
          {prescricoes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 text-center" style={{ padding: '60px 40px' }}>
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto" style={{ marginBottom: '12px' }}>
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-700 font-semibold">Sem prescrições pendentes</p>
              <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>Todas as prescrições foram validadas.</p>
            </div>
          ) : prescricoes.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-amber-200 flex items-center justify-between gap-4" style={{ padding: '20px 24px' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900 text-sm">{p.nome}</p>
                  <span className="text-xs text-slate-500">{p.dose}</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{p.via} · {p.frequencia}</span>
                </div>
                <p className="text-slate-500 text-xs" style={{ marginTop: '4px' }}>
                  Prescrição de {p.prescritoPor?.nome} — {p.doente?.nome}
                </p>
                <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>
                  Quarto {p.doente?.cama?.quarto} · Cama {p.doente?.cama?.numero} · {new Date(p.iniciadoEm).toLocaleDateString('pt-PT')}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link href={`/doentes/${p.doente?.id}`}
                  className="text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                  style={{ padding: '7px 12px' }}>Ver ficha →</Link>
                <button onClick={() => { setModalRejeitar(p.id); setMotivoRejeicao(''); }}
                  className="text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  style={{ padding: '7px 12px' }}>Rejeitar</button>
                <button onClick={() => mutValidar.mutate(p.id)}
                  className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  style={{ padding: '7px 14px' }}>Validar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Rejeitar Prescrição */}
      {modalRejeitar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '400px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">Rejeitar Prescrição</h2>
              <button onClick={() => setModalRejeitar(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo da rejeição *</label>
              <textarea value={motivoRejeicao} onChange={(e) => setMotivoRejeicao(e.target.value)}
                placeholder="Ex: Interação medicamentosa, dose incorreta, contraindicação..."
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                style={{ padding: '10px 14px' }} rows={3} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalRejeitar(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => mutRejeitar.mutate({ id: modalRejeitar, motivo: motivoRejeicao })} disabled={!motivoRejeicao.trim() || mutRejeitar.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>Rejeitar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pedido */}
      {pedidoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '400px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Pedido de Reposição</h2>
              <button onClick={() => setPedidoModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-slate-600 text-sm" style={{ marginBottom: '20px' }}>{pedidoModal.nome}</p>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Quantidade ({pedidoModal.unidade})</label>
              <input type="number" value={pedidoForm.quantidade} onChange={e => setPedidoForm(f => ({ ...f, quantidade: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '10px 14px' }} min={1} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Observações</label>
              <textarea value={pedidoForm.observacoes} onChange={e => setPedidoForm(f => ({ ...f, observacoes: e.target.value }))}
                rows={2} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                style={{ padding: '10px 14px' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPedidoModal(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => pedidoModal && mutPedido.mutate({ stockItemId: pedidoModal.id, quantidade: pedidoForm.quantidade, observacoes: pedidoForm.observacoes })} disabled={mutPedido.isPending || pedidoForm.quantidade <= 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {mutPedido.isPending ? 'A enviar...' : 'Enviar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Item */}
      {novoItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Novo Item de Stock</h2>
              <button onClick={() => setNovoItemModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            {[
              { label: 'Nome *', key: 'nome', type: 'text', placeholder: 'Ex: Paracetamol 500mg' },
              { label: 'Unidade', key: 'unidade', type: 'text', placeholder: 'caixas, ampolas, unidades...' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom: '14px' }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{label}</label>
                <input type={type} value={(novoItemForm as any)[key]} onChange={e => setNovoItemForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ padding: '10px 14px' }} placeholder={placeholder} />
              </div>
            ))}
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo</label>
              <select value={novoItemForm.tipo} onChange={e => setNovoItemForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '10px 14px' }}>
                <option value="medicamento">Medicamento</option>
                <option value="material">Material</option>
                <option value="consumivel">Consumível</option>
              </select>
            </div>
            {[
              { label: 'Quantidade Inicial', key: 'quantidade' },
              { label: 'Quantidade Mínima', key: 'quantidadeMinima' },
            ].map(({ label, key }) => (
              <div key={key} style={{ marginBottom: '14px' }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>{label}</label>
                <input type="number" value={(novoItemForm as any)[key]} onChange={e => setNovoItemForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ padding: '10px 14px' }} min={0} />
              </div>
            ))}
            <div className="flex gap-3" style={{ marginTop: '8px' }}>
              <button onClick={() => setNovoItemModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => mutNovoItem.mutate(novoItemForm)} disabled={mutNovoItem.isPending || !novoItemForm.nome.trim()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {mutNovoItem.isPending ? 'A criar...' : 'Criar Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
