'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface StockItem {
  id: string;
  nome: string;
  tipo: string;
  quantidade: number;
  quantidadeMinima: number;
  unidade: string;
  validade?: string;
  servico: string;
  precoUnitario?: number;
  catalogo?: { dci: string; classeTerap: string };
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

interface Transferencia {
  id: string;
  quantidade: number;
  servicoOrigem: string;
  servicoDestino: string;
  motivo?: string;
  estado: string;
  criadoEm: string;
  stockItem: { id: string; nome: string; unidade: string };
  solicitadoPor: { id: string; nome: string };
  confirmadoPor?: { id: string; nome: string };
}

interface AjusteStock {
  id: string;
  delta: number;
  tipo: string;
  motivo: string;
  criadoEm: string;
  utilizador: { id: string; nome: string; role: string };
}

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

interface PedidoPendente {
  id: string;
  quantidade: number;
  servico: string;
  observacoes?: string;
  criadoEm: string;
  stockItem: { id: string; nome: string; unidade: string; quantidade: number };
  solicitadoPor: { id: string; nome: string; role: string; servico: string };
}

const ESTADO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pendente:   { label: 'Pendente',   bg: 'bg-amber-50',  text: 'text-amber-700' },
  aprovado:   { label: 'Aprovado',   bg: 'bg-blue-50',   text: 'text-blue-700' },
  dispensado: { label: 'Dispensado', bg: 'bg-green-50',  text: 'text-green-700' },
  cancelado:  { label: 'Cancelado',  bg: 'bg-slate-100', text: 'text-slate-600' },
  confirmada: { label: 'Confirmada', bg: 'bg-green-50',  text: 'text-green-700' },
};

const TIPO_LABELS: Record<string, string> = {
  medicamento: 'Medicamento',
  material:    'Material',
  consumivel:  'Consumível',
};

const TIPO_AJUSTE_OPTS = [
  { value: 'entrada',      label: 'Entrada' },
  { value: 'saida',        label: 'Saída' },
  { value: 'ajuste',       label: 'Ajuste de inventário' },
  { value: 'desperdicio',  label: 'Desperdício / quebra' },
  { value: 'validade',     label: 'Validade expirada' },
];

const SERVICOS = ['internamento', 'urgencia', 'bloco_operatorio', 'consultas_externas', 'farmacia', 'fisioterapia'];

export default function FarmaciaPage() {
  const { utilizador } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<'stock' | 'pedidos' | 'alertas' | 'validacao' | 'transferencias' | 'relatorio' | 'aprovacao_medico'>('stock');

  // Modais
  const [pedidoModal, setPedidoModal] = useState<StockItem | null>(null);
  const [pedidoForm, setPedidoForm] = useState({ quantidade: 1, observacoes: '' });
  const [novoItemModal, setNovoItemModal] = useState(false);
  const [novoItemForm, setNovoItemForm] = useState({ nome: '', tipo: 'medicamento', quantidade: 0, quantidadeMinima: 5, unidade: 'unidades', servico: utilizador?.servico ?? 'farmacia', precoUnitario: '', catalogoId: '' });
  const [ajustarModal, setAjustarModal] = useState<StockItem | null>(null);
  const [ajustarForm, setAjustarForm] = useState({ quantidade: 0, motivo: '', tipo: 'ajuste' });
  const [historicoModal, setHistoricoModal] = useState<StockItem | null>(null);
  const [transferirModal, setTransferirModal] = useState<StockItem | null>(null);
  const [transferirForm, setTransferirForm] = useState({ servicoDestino: '', quantidade: 1, motivo: '' });
  const [modalRejeitar, setModalRejeitar] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [modalRejeitarPedido, setModalRejeitarPedido] = useState<string | null>(null);
  const [motivoRejPedido, setMotivoRejPedido] = useState('');

  // Filtros relatório
  const [relServico, setRelServico] = useState('');
  const [relInicio, setRelInicio] = useState('');
  const [relFim, setRelFim] = useState('');

  const isFarmaceutico = utilizador?.role === 'farmaceutico';
  const isFarmacia = ['farmaceutico', 'tecnico_farmacia'].includes(utilizador?.role ?? '');
  const isMedico = utilizador?.role === 'medico' || utilizador?.role === 'direcao';

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
      return { stock: s.data ?? [], pedidos: p.data ?? [], alertas: a.data ?? {}, prescricoes: presc?.data ?? [] };
    },
    staleTime: 30_000,
  });

  const { data: transferencias = [], isLoading: loadingTransf } = useQuery<Transferencia[]>({
    queryKey: ['transferencias'],
    queryFn: () => api.get('/farmacia/transferencias').then(r => r.data ?? []),
    enabled: tab === 'transferencias',
    staleTime: 30_000,
  });

  const { data: historico = [], isLoading: loadingHistorico } = useQuery<AjusteStock[]>({
    queryKey: ['historico-stock', historicoModal?.id],
    queryFn: () => api.get(`/farmacia/stock/${historicoModal!.id}/historico`).then(r => r.data ?? []),
    enabled: !!historicoModal,
  });

  const { data: catalogoItems = [] } = useQuery<Array<{ id: string; dci: string; nomeMarca?: string; unidade: string; classeTerap: string }>>({
    queryKey: ['catalogo-select'],
    queryFn: () => api.get('/catalogo').then(r => r.data ?? []),
    staleTime: 300_000,
    enabled: novoItemModal,
  });

  const { data: relatorio, isLoading: loadingRelatorio, refetch: buscarRelatorio } = useQuery({
    queryKey: ['relatorio-gastos', relServico, relInicio, relFim],
    queryFn: () => {
      const params = new URLSearchParams();
      if (relServico) params.set('servico', relServico);
      if (relInicio) params.set('dataInicio', relInicio);
      if (relFim) params.set('dataFim', relFim);
      return api.get(`/farmacia/relatorio-gastos?${params}`).then(r => r.data);
    },
    enabled: tab === 'relatorio',
    staleTime: 60_000,
  });

  const stock: StockItem[] = ((data as any).stock ?? []).slice(0, 100);
  const pedidos: PedidoFarmacia[] = (data as any).pedidos ?? [];
  const alertasData = (data as any).alertas ?? {};
  const alertasItems: StockItem[] = [...(alertasData.stockMinimo ?? []), ...(alertasData.validadeProxima ?? [])];
  const prescricoes: PrescricaoPendente[] = (data as any).prescricoes ?? [];
  const invalidar = () => { qc.invalidateQueries({ queryKey: ['farmacia'] }); qc.invalidateQueries({ queryKey: ['transferencias'] }); };

  // Mutations
  const mutPedido = useMutation({
    mutationFn: (body: any) => api.post('/farmacia/pedido', body),
    onSuccess: () => { toast.success('Pedido criado com sucesso'); setPedidoModal(null); setPedidoForm({ quantidade: 1, observacoes: '' }); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao criar pedido'),
  });

  const mutDispensar = useMutation({
    mutationFn: (id: string) => api.patch(`/farmacia/pedido/${id}/dispensar`),
    onSuccess: () => { toast.success('Pedido dispensado'); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao dispensar'),
  });

  const mutNovoItem = useMutation({
    mutationFn: (body: any) => api.post('/farmacia/stock', {
      ...body,
      precoUnitario: body.precoUnitario ? Number(body.precoUnitario) : undefined,
      catalogoId: body.catalogoId || undefined,
    }),
    onSuccess: () => { toast.success('Item criado no stock'); setNovoItemModal(false); setNovoItemForm({ nome: '', tipo: 'medicamento', quantidade: 0, quantidadeMinima: 5, unidade: 'unidades', servico: utilizador?.servico ?? 'farmacia', precoUnitario: '', catalogoId: '' }); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao criar item'),
  });

  const mutAjustar = useMutation({
    mutationFn: (body: any) => api.patch(`/farmacia/stock/${ajustarModal!.id}`, body),
    onSuccess: () => { toast.success('Stock ajustado com sucesso'); setAjustarModal(null); setAjustarForm({ quantidade: 0, motivo: '', tipo: 'ajuste' }); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao ajustar stock'),
  });

  const mutTransferir = useMutation({
    mutationFn: (body: any) => api.post(`/farmacia/stock/${transferirModal!.id}/transferir`, body),
    onSuccess: () => { toast.success('Transferência criada com sucesso'); setTransferirModal(null); setTransferirForm({ servicoDestino: '', quantidade: 1, motivo: '' }); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao criar transferência'),
  });

  const mutConfirmarTransf = useMutation({
    mutationFn: (id: string) => api.patch(`/farmacia/transferencias/${id}/confirmar`),
    onSuccess: () => { toast.success('Transferência confirmada'); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao confirmar transferência'),
  });

  const mutCancelarTransf = useMutation({
    mutationFn: (id: string) => api.patch(`/farmacia/transferencias/${id}/cancelar`),
    onSuccess: () => { toast.success('Transferência cancelada'); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao cancelar transferência'),
  });

  const mutValidar = useMutation({
    mutationFn: (id: string) => api.patch(`/medicacao/${id}/validar`),
    onSuccess: () => { toast.success('Prescrição validada'); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao validar prescrição'),
  });

  const mutRejeitar = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => api.patch(`/medicacao/${id}/rejeitar`, { motivoRejeicao: motivo }),
    onSuccess: () => { toast.success('Prescrição rejeitada'); setModalRejeitar(null); setMotivoRejeicao(''); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao rejeitar prescrição'),
  });

  const { data: pendentesAprovacao = [], isLoading: loadingPendentes } = useQuery<PedidoPendente[]>({
    queryKey: ['farmacia-pendentes-aprovacao'],
    queryFn: () => api.get('/farmacia/pedidos/pendentes-aprovacao').then(r => r.data ?? []),
    enabled: isMedico,
    staleTime: 30_000,
  });

  const mutAprovarPedido = useMutation({
    mutationFn: (id: string) => api.patch(`/farmacia/pedido/${id}/aprovar`),
    onSuccess: () => { toast.success('Pedido aprovado'); qc.invalidateQueries({ queryKey: ['farmacia-pendentes-aprovacao'] }); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao aprovar pedido'),
  });

  const mutRejeitarPedido = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => api.patch(`/farmacia/pedido/${id}/rejeitar`, { motivoRejeicao: motivo }),
    onSuccess: () => { toast.success('Pedido rejeitado'); setModalRejeitarPedido(null); setMotivoRejPedido(''); qc.invalidateQueries({ queryKey: ['farmacia-pendentes-aprovacao'] }); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao rejeitar pedido'),
  });

  const TABS = [
    { id: 'stock',          label: 'Stock',           count: 0 },
    { id: 'pedidos',        label: 'Pedidos',         count: pedidos.filter(p => p.estado === 'pendente').length },
    { id: 'alertas',        label: 'Alertas',         count: alertasItems.length },
    { id: 'transferencias', label: 'Transferências',  count: (transferencias as Transferencia[]).filter(t => t.estado === 'pendente').length },
    ...(isMedico ? [{ id: 'aprovacao_medico', label: 'Aprovação Médica', count: pendentesAprovacao.length }] : []),
    ...(isFarmaceutico || isFarmacia ? [{ id: 'relatorio', label: 'Relatório', count: 0 }] : []),
    ...(isFarmaceutico ? [{ id: 'validacao', label: 'Validação', count: prescricoes.length }] : []),
  ];

  const fmtDelta = (delta: number) => delta > 0 ? `+${delta}` : `${delta}`;

  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Farmácia</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>Gestão de stock, transferências e encomendas</p>
        </div>
        {isFarmacia && (
          <button onClick={() => setNovoItemModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
            style={{ padding: '10px 20px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Novo Item
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1" style={{ marginBottom: '24px', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 font-semibold text-sm rounded-lg transition-all ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            style={{ padding: '8px 16px' }}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${t.id === 'alertas' ? 'bg-red-500' : t.id === 'aprovacao_medico' ? 'bg-blue-500' : 'bg-amber-500'}`}>{t.count}</span>
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
                  <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '4px' }}>
                    <p className="font-semibold text-slate-900 text-sm">{item.nome}</p>
                    <span className="text-xs text-slate-400 bg-slate-100 badge-pad py-0.5 rounded-full">{TIPO_LABELS[item.tipo] ?? item.tipo}</span>
                    {item.catalogo && <span className="text-xs text-indigo-600 bg-indigo-50 badge-pad py-0.5 rounded-full">{item.catalogo.classeTerap}</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-sm font-bold ${baixo ? 'text-red-600' : 'text-slate-700'}`}>{item.quantidade} {item.unidade}</span>
                    <span className="text-xs text-slate-400">mín: {item.quantidadeMinima} {item.unidade}</span>
                    {item.validade && <span className="text-xs text-slate-400">val: {new Date(item.validade).toLocaleDateString('pt-PT')}</span>}
                    {item.precoUnitario && <span className="text-xs text-slate-400">{item.precoUnitario.toFixed(2)}€/{item.unidade}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {baixo && <span className="text-xs font-semibold text-red-600 bg-red-50 badge-pad py-1 rounded-full">Stock baixo</span>}
                  <button onClick={() => { setHistoricoModal(item); }}
                    className="text-xs font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                    style={{ padding: '7px 12px' }}>Histórico</button>
                  <button onClick={() => { setTransferirModal(item); setTransferirForm({ servicoDestino: '', quantidade: 1, motivo: '' }); }}
                    className="text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    style={{ padding: '7px 12px' }}>Transferir</button>
                  {isFarmaceutico && (
                    <button onClick={() => { setAjustarModal(item); setAjustarForm({ quantidade: item.quantidade, motivo: '', tipo: 'ajuste' }); }}
                      className="text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                      style={{ padding: '7px 12px' }}>Ajustar</button>
                  )}
                  <button onClick={() => { setPedidoModal(item); setPedidoForm({ quantidade: 1, observacoes: '' }); }}
                    className="text-xs font-semibold border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                    style={{ padding: '7px 14px' }}>Pedir</button>
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
                  <p className="text-slate-500 text-xs" style={{ marginTop: '2px' }}>{p.quantidade} {p.stockItem?.unidade} — Pedido por {p.solicitadoPor?.nome}</p>
                  <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
                    <span className={`text-xs font-medium badge-pad py-1 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    <span className="text-xs text-slate-400">{new Date(p.criadoEm).toLocaleDateString('pt-PT')}</span>
                  </div>
                </div>
                {p.estado === 'aprovado' && isFarmacia && (
                  <button onClick={() => mutDispensar.mutate(p.id)}
                    className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shrink-0"
                    style={{ padding: '7px 14px' }}>Dispensar</button>
                )}
              </div>
            );
          })}
        </div>
      ) : tab === 'alertas' ? (
        <div className="grid gap-3">
          {alertasItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '60px 40px' }}>
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto" style={{ marginBottom: '12px' }}>
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-slate-700 font-semibold">Sem alertas</p>
              <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>Todo o stock está dentro dos níveis mínimos.</p>
            </div>
          ) : alertasItems.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-red-200 flex items-center justify-between gap-4" style={{ padding: '20px 24px' }}>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{item.nome}</p>
                <p className="text-red-600 text-sm font-medium" style={{ marginTop: '2px' }}>{item.quantidade} {item.unidade} (mínimo: {item.quantidadeMinima})</p>
              </div>
              <button onClick={() => { setPedidoModal(item); setPedidoForm({ quantidade: Math.max(1, item.quantidadeMinima - item.quantidade), observacoes: '' }); }}
                className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shrink-0"
                style={{ padding: '7px 14px' }}>Repor</button>
            </div>
          ))}
        </div>
      ) : tab === 'transferencias' ? (
        <div className="grid gap-3">
          {loadingTransf ? (
            <div className="flex justify-center" style={{ padding: '40px 0' }}>
              <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            </div>
          ) : (transferencias as Transferencia[]).length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '60px 40px' }}>
              <p className="text-slate-500">Nenhuma transferência registada.</p>
            </div>
          ) : (transferencias as Transferencia[]).map(t => {
            const cfg = ESTADO_CONFIG[t.estado] ?? ESTADO_CONFIG.pendente;
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-4" style={{ padding: '20px 24px' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '4px' }}>
                    <p className="font-semibold text-slate-900 text-sm">{t.stockItem?.nome}</p>
                    <span className="text-xs text-slate-500">{t.quantidade} {t.stockItem?.unidade}</span>
                  </div>
                  <p className="text-slate-500 text-xs">{t.servicoOrigem} → {t.servicoDestino}</p>
                  {t.motivo && <p className="text-slate-400 text-xs" style={{ marginTop: '2px' }}>{t.motivo}</p>}
                  <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
                    <span className={`text-xs font-medium badge-pad py-1 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    <span className="text-xs text-slate-400">por {t.solicitadoPor?.nome} · {new Date(t.criadoEm).toLocaleDateString('pt-PT')}</span>
                  </div>
                </div>
                {t.estado === 'pendente' && isFarmaceutico && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => mutCancelarTransf.mutate(t.id)}
                      className="text-xs font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                      style={{ padding: '7px 12px' }}>Cancelar</button>
                    <button onClick={() => mutConfirmarTransf.mutate(t.id)}
                      className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      style={{ padding: '7px 14px' }}>Confirmar</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : tab === 'relatorio' ? (
        <div>
          {/* Filtros */}
          <div className="bg-white rounded-2xl border border-slate-200 flex flex-wrap gap-4 items-end" style={{ padding: '20px 24px', marginBottom: '20px' }}>
            <div>
              <label htmlFor="fpage-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Serviço</label>
              <select id="fpage-0" value={relServico} onChange={e => setRelServico(e.target.value)}
                className="border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '8px 12px' }}>
                <option value="">Todos</option>
                {SERVICOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="fpage-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Data início</label>
              <input id="fpage-1" type="date" value={relInicio} onChange={e => setRelInicio(e.target.value)}
                className="border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '8px 12px' }} />
            </div>
            <div>
              <label htmlFor="fpage-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Data fim</label>
              <input id="fpage-2" type="date" value={relFim} onChange={e => setRelFim(e.target.value)}
                className="border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '8px 12px' }} />
            </div>
            <button onClick={() => buscarRelatorio()}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors"
              style={{ padding: '8px 18px' }}>Calcular</button>
          </div>
          {loadingRelatorio ? (
            <div className="flex justify-center" style={{ padding: '40px 0' }}>
              <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            </div>
          ) : relatorio ? (
            <div>
              <div className="bg-slate-900 text-white rounded-2xl flex items-center justify-between" style={{ padding: '20px 28px', marginBottom: '16px' }}>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Custo total de consumo</p>
                  <p className="text-3xl font-bold" style={{ marginTop: '4px' }}>{relatorio.custoTotal?.toFixed(2)}€</p>
                  <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>Calculado com base em saídas × preço unitário</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left font-semibold text-slate-600 text-xs uppercase tracking-wide" style={{ padding: '12px 20px 12px 32px' }}>Item</th>
                      <th className="text-left font-semibold text-slate-600 text-xs uppercase tracking-wide" style={{ padding: '12px 20px' }}>Serviço</th>
                      <th className="text-right font-semibold text-slate-600 text-xs uppercase tracking-wide" style={{ padding: '12px 20px' }}>Consumo</th>
                      <th className="text-right font-semibold text-slate-600 text-xs uppercase tracking-wide" style={{ padding: '12px 20px' }}>Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(relatorio.itens ?? []).map((item: any, i: number) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="font-medium text-slate-900" style={{ padding: '12px 20px 12px 32px' }}>{item.nome}</td>
                        <td className="text-slate-500" style={{ padding: '12px 20px' }}>{item.servico}</td>
                        <td className="text-right text-slate-700" style={{ padding: '12px 20px' }}>{item.consumo} {item.unidade}</td>
                        <td className="text-right font-semibold text-slate-900" style={{ padding: '12px 20px' }}>{item.custo > 0 ? `${item.custo.toFixed(2)}€` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '60px 40px' }}>
              <p className="text-slate-500">Selecciona um período e clica em Calcular.</p>
            </div>
          )}
        </div>
      ) : null}

      {/* Tab Validação */}
      {!loading && tab === 'validacao' && (
        <div className="grid gap-3">
          {prescricoes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 text-center" style={{ padding: '60px 40px' }}>
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto" style={{ marginBottom: '12px' }}>
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-slate-700 font-semibold">Sem prescrições pendentes</p>
            </div>
          ) : prescricoes.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-amber-200 flex items-center justify-between gap-4" style={{ padding: '20px 24px' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900 text-sm">{p.nome}</p>
                  <span className="text-xs text-slate-500">{p.dose}</span>
                  <span className="text-xs bg-slate-100 text-slate-600 badge-pad py-0.5 rounded-md">{p.via} · {p.frequencia}</span>
                </div>
                <p className="text-slate-500 text-xs" style={{ marginTop: '4px' }}>Prescrição de {p.prescritoPor?.nome} — {p.doente?.nome}</p>
                <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Quarto {p.doente?.cama?.quarto} · Cama {p.doente?.cama?.numero} · {new Date(p.iniciadoEm).toLocaleDateString('pt-PT')}</p>
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

      {!loading && tab === 'aprovacao_medico' && (
        <div className="grid gap-3">
          {loadingPendentes ? (
            <div className="flex justify-center" style={{ padding: '40px 0' }}>
              <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            </div>
          ) : pendentesAprovacao.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 text-center" style={{ padding: '60px 40px' }}>
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto" style={{ marginBottom: '12px' }}>
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-slate-700 font-semibold">Sem pedidos para aprovar</p>
              <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>Todos os pedidos de medicação estão tratados.</p>
            </div>
          ) : pendentesAprovacao.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-blue-100 flex items-center justify-between gap-4" style={{ padding: '20px 24px' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '4px' }}>
                  <p className="font-semibold text-slate-900 text-sm">{p.stockItem?.nome}</p>
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 badge-pad py-0.5 rounded-full">Aguarda aprovação</span>
                </div>
                <p className="text-slate-500 text-xs">{p.quantidade} {p.stockItem?.unidade} — Solicitado por {p.solicitadoPor?.nome} ({p.solicitadoPor?.role})</p>
                {p.observacoes && <p className="text-slate-400 text-xs" style={{ marginTop: '2px' }}>Obs: {p.observacoes}</p>}
                <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>Serviço: {p.servico} · Stock disponível: {p.stockItem?.quantidade} {p.stockItem?.unidade} · {new Date(p.criadoEm).toLocaleDateString('pt-PT')}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setModalRejeitarPedido(p.id); setMotivoRejPedido(''); }}
                  className="text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  style={{ padding: '7px 12px' }}>Rejeitar</button>
                <button onClick={() => mutAprovarPedido.mutate(p.id)} disabled={mutAprovarPedido.isPending}
                  className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  style={{ padding: '7px 14px' }}>Aprovar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modais ── */}

      {/* Rejeitar Prescrição */}
      {modalRejeitar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '400px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">Rejeitar Prescrição</h2>
              <button aria-label="Fechar" onClick={() => setModalRejeitar(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="fpage-3" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo *</label>
              <textarea id="fpage-3" value={motivoRejeicao} onChange={e => setMotivoRejeicao(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                style={{ padding: '10px 14px' }} rows={3} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalRejeitar(null)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => mutRejeitar.mutate({ id: modalRejeitar, motivo: motivoRejeicao })} disabled={!motivoRejeicao.trim() || mutRejeitar.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>Rejeitar</button>
            </div>
          </div>
        </div>
      )}

      {/* Rejeitar Pedido Médico */}
      {modalRejeitarPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '400px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">Rejeitar Pedido</h2>
              <button aria-label="Fechar" onClick={() => setModalRejeitarPedido(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="fpage-4" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo clínico *</label>
              <textarea id="fpage-4" value={motivoRejPedido} onChange={e => setMotivoRejPedido(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                style={{ padding: '10px 14px' }} rows={3} placeholder="Ex: Contra-indicação com medicação atual..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalRejeitarPedido(null)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => mutRejeitarPedido.mutate({ id: modalRejeitarPedido, motivo: motivoRejPedido })}
                disabled={!motivoRejPedido.trim() || mutRejeitarPedido.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>Rejeitar</button>
            </div>
          </div>
        </div>
      )}

      {/* Pedido de Reposição */}
      {pedidoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '400px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Pedido de Reposição</h2>
              <button aria-label="Fechar" onClick={() => setPedidoModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-slate-600 text-sm" style={{ marginBottom: '20px' }}>{pedidoModal.nome}</p>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-5" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Quantidade ({pedidoModal.unidade})</label>
              <input id="fpage-5" type="number" value={pedidoForm.quantidade} onChange={e => setPedidoForm(f => ({ ...f, quantidade: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '10px 14px' }} min={1} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="fpage-6" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Observações</label>
              <textarea id="fpage-6" value={pedidoForm.observacoes} onChange={e => setPedidoForm(f => ({ ...f, observacoes: e.target.value }))}
                rows={2} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                style={{ padding: '10px 14px' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPedidoModal(null)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => mutPedido.mutate({ stockItemId: pedidoModal.id, quantidade: pedidoForm.quantidade, observacoes: pedidoForm.observacoes, servico: pedidoModal.servico })}
                disabled={mutPedido.isPending || pedidoForm.quantidade <= 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {mutPedido.isPending ? 'A enviar...' : 'Enviar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ajustar Quantidade */}
      {ajustarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">Ajustar Stock</h2>
              <button aria-label="Fechar" onClick={() => setAjustarModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-slate-600 text-sm font-medium" style={{ marginBottom: '20px' }}>{ajustarModal.nome} — actual: {ajustarModal.quantidade} {ajustarModal.unidade}</p>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-7" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo de movimento *</label>
              <select id="fpage-7" value={ajustarForm.tipo} onChange={e => setAjustarForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '10px 14px' }}>
                {TIPO_AJUSTE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-8" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Nova quantidade ({ajustarModal.unidade}) *</label>
              <input id="fpage-8" type="number" value={ajustarForm.quantidade} onChange={e => setAjustarForm(f => ({ ...f, quantidade: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '10px 14px' }} min={0} />
              {ajustarForm.quantidade !== ajustarModal.quantidade && (
                <p className={`text-xs font-semibold mt-1 ${ajustarForm.quantidade > ajustarModal.quantidade ? 'text-green-600' : 'text-red-600'}`}>
                  {fmtDelta(ajustarForm.quantidade - ajustarModal.quantidade)} {ajustarModal.unidade}
                </p>
              )}
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="fpage-9" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo *</label>
              <textarea id="fpage-9" value={ajustarForm.motivo} onChange={e => setAjustarForm(f => ({ ...f, motivo: e.target.value }))}
                placeholder="Descreve o motivo do ajuste..."
                rows={2} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                style={{ padding: '10px 14px' }} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAjustarModal(null)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => mutAjustar.mutate({ quantidade: ajustarForm.quantidade, motivo: ajustarForm.motivo, tipo: ajustarForm.tipo })}
                disabled={mutAjustar.isPending || !ajustarForm.motivo.trim()}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {mutAjustar.isPending ? 'A guardar...' : 'Guardar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Histórico de Ajustes */}
      {historicoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '540px', padding: '32px', margin: '0 16px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Histórico de Ajustes</h2>
                <p className="text-slate-500 text-sm">{historicoModal.nome}</p>
              </div>
              <button aria-label="Fechar" onClick={() => setHistoricoModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            {loadingHistorico ? (
              <div className="flex justify-center" style={{ padding: '32px 0' }}>
                <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              </div>
            ) : historico.length === 0 ? (
              <p className="text-slate-500 text-center" style={{ padding: '32px 0' }}>Nenhum ajuste registado.</p>
            ) : (
              <div className="grid gap-3">
                {historico.map(a => (
                  <div key={a.id} className="border border-slate-100 rounded-xl" style={{ padding: '14px 16px' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                      <span className={`text-sm font-bold ${a.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtDelta(a.delta)} {historicoModal.unidade}</span>
                      <span className="text-xs text-slate-400">{new Date(a.criadoEm).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-slate-500">{a.motivo}</p>
                    <div className="flex items-center gap-2" style={{ marginTop: '6px' }}>
                      <span className="text-xs bg-slate-100 text-slate-600 badge-pad py-0.5 rounded-md">{a.tipo}</span>
                      <span className="text-xs text-slate-400">por {a.utilizador?.nome}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transferir Stock */}
      {transferirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">Transferir Stock</h2>
              <button aria-label="Fechar" onClick={() => setTransferirModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-slate-600 text-sm font-medium" style={{ marginBottom: '20px' }}>{transferirModal.nome} — disponível: {transferirModal.quantidade} {transferirModal.unidade} ({transferirModal.servico})</p>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-10" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Serviço destino *</label>
              <select id="fpage-10" value={transferirForm.servicoDestino} onChange={e => setTransferirForm(f => ({ ...f, servicoDestino: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '10px 14px' }}>
                <option value="">Seleccionar...</option>
                {SERVICOS.filter(s => s !== transferirModal.servico).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-11" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Quantidade ({transferirModal.unidade}) *</label>
              <input id="fpage-11" type="number" value={transferirForm.quantidade} onChange={e => setTransferirForm(f => ({ ...f, quantidade: Number(e.target.value) }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '10px 14px' }} min={1} max={transferirModal.quantidade} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="fpage-12" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo</label>
              <textarea id="fpage-12" value={transferirForm.motivo} onChange={e => setTransferirForm(f => ({ ...f, motivo: e.target.value }))}
                rows={2} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Motivo opcional..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setTransferirModal(null)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => mutTransferir.mutate({ servicoDestino: transferirForm.servicoDestino, quantidade: transferirForm.quantidade, motivo: transferirForm.motivo || undefined })}
                disabled={mutTransferir.isPending || !transferirForm.servicoDestino || transferirForm.quantidade <= 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {mutTransferir.isPending ? 'A transferir...' : 'Criar Transferência'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Novo Item */}
      {novoItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Novo Item de Stock</h2>
              <button aria-label="Fechar" onClick={() => setNovoItemModal(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-13" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Ligar ao Catálogo</label>
              <select id="fpage-13"
                value={novoItemForm.catalogoId}
                onChange={e => {
                  const cat = (catalogoItems as Array<{ id: string; dci: string; nomeMarca?: string; unidade: string; classeTerap: string }>).find(c => c.id === e.target.value);
                  setNovoItemForm(f => ({
                    ...f,
                    catalogoId: e.target.value,
                    nome: cat ? (cat.nomeMarca ?? cat.dci) : f.nome,
                    unidade: cat ? cat.unidade : f.unidade,
                  }));
                }}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '10px 14px' }}>
                <option value="">— Sem ligação ao catálogo —</option>
                {(catalogoItems as Array<{ id: string; dci: string; nomeMarca?: string; unidade: string; classeTerap: string }>).map(c => (
                  <option key={c.id} value={c.id}>{c.dci}{c.nomeMarca ? ` (${c.nomeMarca})` : ''} · {c.classeTerap}</option>
                ))}
              </select>
              {novoItemForm.catalogoId && <p className="text-xs text-emerald-600 mt-1">✓ Nome e unidade preenchidos automaticamente</p>}
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-14" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Nome *</label>
              <input id="fpage-14" type="text" value={novoItemForm.nome} onChange={e => setNovoItemForm(f => ({ ...f, nome: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '10px 14px' }} placeholder="Ex: Paracetamol 500mg" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-15" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo</label>
              <select id="fpage-15" value={novoItemForm.tipo} onChange={e => setNovoItemForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '10px 14px' }}>
                <option value="medicamento">Medicamento</option>
                <option value="material">Material</option>
                <option value="consumivel">Consumível</option>
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-16" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Unidade</label>
              <input id="fpage-16" type="text" value={novoItemForm.unidade} onChange={e => setNovoItemForm(f => ({ ...f, unidade: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '10px 14px' }} placeholder="caixas, ampolas, unidades..." />
            </div>
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
              <div>
                <label htmlFor="fpage-17" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Qtd. inicial</label>
                <input id="fpage-17" type="number" value={novoItemForm.quantidade} onChange={e => setNovoItemForm(f => ({ ...f, quantidade: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ padding: '10px 14px' }} min={0} />
              </div>
              <div>
                <label htmlFor="fpage-18" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Qtd. mínima</label>
                <input id="fpage-18" type="number" value={novoItemForm.quantidadeMinima} onChange={e => setNovoItemForm(f => ({ ...f, quantidadeMinima: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ padding: '10px 14px' }} min={0} />
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-19" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Preço unitário (€)</label>
              <input id="fpage-19" type="number" value={novoItemForm.precoUnitario} onChange={e => setNovoItemForm(f => ({ ...f, precoUnitario: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ padding: '10px 14px' }} min={0} step="0.01" placeholder="0.00" />
            </div>
            <div className="flex gap-3" style={{ marginTop: '8px' }}>
              <button onClick={() => setNovoItemModal(false)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => mutNovoItem.mutate(novoItemForm)} disabled={mutNovoItem.isPending || !novoItemForm.nome.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {mutNovoItem.isPending ? 'A criar...' : 'Criar Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
