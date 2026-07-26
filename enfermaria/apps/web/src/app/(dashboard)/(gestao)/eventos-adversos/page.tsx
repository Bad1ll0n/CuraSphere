'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface EventoAdverso {
  id: string;
  tipo: string;
  gravidade: string;
  descricao: string;
  servicoId?: string;
  acaoCorretiva?: string;
  estado: 'aberto' | 'em_investigacao' | 'encerrado';
  ocorridoEm: string;
  criadoEm: string;
  doente?: { id: string; nome: string };
  registadoPor?: { id: string; nome: string; role: string };
}

const TIPO_LABEL: Record<string, string> = {
  queda: 'Queda', erro_medicacao: 'Erro de Medicação', near_miss: 'Near Miss',
  infecao: 'Infeção', lesao_pressao: 'Lesão por Pressão', outro: 'Outro',
};

const GRAVIDADE_COR: Record<string, string> = {
  sem_dano: 'bg-green-50 text-green-700 border-green-200',
  dano_leve: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  dano_moderado: 'bg-orange-50 text-orange-700 border-orange-200',
  dano_grave: 'bg-red-50 text-red-700 border-red-200',
  obito: 'bg-slate-800 text-white border-slate-700',
};

const GRAVIDADE_LABEL: Record<string, string> = {
  sem_dano: 'Sem Dano', dano_leve: 'Dano Leve', dano_moderado: 'Dano Moderado',
  dano_grave: 'Dano Grave', obito: 'Óbito',
};

const ESTADO_COR: Record<string, string> = {
  aberto: 'bg-amber-50 text-amber-700',
  em_investigacao: 'bg-blue-50 text-blue-700',
  encerrado: 'bg-slate-100 text-slate-500',
};

const ESTADO_LABEL: Record<string, string> = {
  aberto: 'Aberto', em_investigacao: 'Em Investigação', encerrado: 'Encerrado',
};

const SERVICOS = ['internamento', 'urgencia', 'bloco', 'consultas', 'farmacia', 'fisioterapia', 'outro'];

export default function EventosAdversosPage() {
  const { utilizador } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroGravidade, setFiltroGravidade] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [modalNovo, setModalNovo] = useState(false);
  const [form, setForm] = useState({
    tipo: 'queda', gravidade: 'dano_leve', descricao: '', servicoId: '',
    doenteId: '', acaoCorretiva: '', ocorridoEm: new Date().toISOString().slice(0, 16),
  });
  const [modalAcao, setModalAcao] = useState<EventoAdverso | null>(null);
  const [acaoTexto, setAcaoTexto] = useState('');
  const [novoEstado, setNovoEstado] = useState('');

  const role = utilizador?.role ?? '';
  const podeRegistar = ['medico', 'enfermeiro', 'auxiliar', 'qualidade'].includes(role);
  const podeGerir = ['qualidade', 'direcao', 'medico'].includes(role);

  const { data: eventos = [], isLoading: loading } = useQuery<EventoAdverso[]>({
    queryKey: ['eventos-adversos', filtroTipo, filtroGravidade, filtroEstado],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroGravidade) params.set('gravidade', filtroGravidade);
      if (filtroEstado) params.set('estado', filtroEstado);
      return api.get(`/eventos-adversos?${params.toString()}`).then(r => r.data).catch(() => []);
    },
    staleTime: 30_000,
  });

  const { data: doentesLista = [] } = useQuery<{ id: string; nome: string }[]>({
    queryKey: ['doentes-lista-eventos'],
    queryFn: () => api.get('/doentes?todos=true').then(r => (r.data?.data ?? r.data ?? []).map((d: any) => ({ id: d.id, nome: d.nome }))).catch(() => []),
    enabled: modalNovo,
    staleTime: 60_000,
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ['eventos-adversos'] });

  const mutCriar = useMutation({
    mutationFn: (body: object) => api.post('/eventos-adversos', body),
    onSuccess: () => {
      toast.success('Evento adverso registado');
      setModalNovo(false);
      setForm({ tipo: 'queda', gravidade: 'dano_leve', descricao: '', servicoId: '', doenteId: '', acaoCorretiva: '', ocorridoEm: new Date().toISOString().slice(0, 16) });
      invalidar();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao registar evento'),
  });

  const mutAcao = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => api.patch(`/eventos-adversos/${id}`, body),
    onSuccess: () => { toast.success('Evento adverso actualizado'); setModalAcao(null); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao actualizar evento'),
  });

  const criar = () => {
    if (!form.descricao.trim()) return;
    mutCriar.mutate({ ...form, servicoId: form.servicoId || undefined, doenteId: form.doenteId || undefined, acaoCorretiva: form.acaoCorretiva || undefined });
  };

  const guardarAcao = () => {
    if (!modalAcao) return;
    mutAcao.mutate({ id: modalAcao.id, body: { acaoCorretiva: acaoTexto || undefined, estado: novoEstado || undefined } });
  };

  const gravesCount = eventos.filter(e => ['dano_grave', 'obito'].includes(e.gravidade)).length;
  const abertosCount = eventos.filter(e => e.estado === 'aberto').length;

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1024px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Eventos Adversos</h1>
          <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>
            Registo de incidentes, quedas, erros de medicação e near misses
          </p>
        </div>
        {podeRegistar && (
          <button onClick={() => setModalNovo(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
            style={{ padding: '10px 18px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Registar Evento
          </button>
        )}
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: '24px' }}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '16px 20px' }}>
          <p className="text-2xl font-bold text-slate-800">{eventos.length}</p>
          <p className="text-xs font-medium text-slate-500" style={{ marginTop: '3px' }}>Total (filtro atual)</p>
        </div>
        <div className={`rounded-2xl border shadow-sm ${abertosCount > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100'}`} style={{ padding: '16px 20px' }}>
          <p className={`text-2xl font-bold ${abertosCount > 0 ? 'text-amber-700' : 'text-slate-800'}`}>{abertosCount}</p>
          <p className="text-xs font-medium text-slate-500" style={{ marginTop: '3px' }}>Em aberto</p>
        </div>
        <div className={`rounded-2xl border shadow-sm ${gravesCount > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`} style={{ padding: '16px 20px' }}>
          <p className={`text-2xl font-bold ${gravesCount > 0 ? 'text-red-700' : 'text-slate-800'}`}>{gravesCount}</p>
          <p className="text-xs font-medium text-slate-500" style={{ marginTop: '3px' }}>Dano grave / Óbito</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3" style={{ marginBottom: '20px' }}>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          style={{ padding: '8px 12px' }}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filtroGravidade} onChange={e => setFiltroGravidade(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          style={{ padding: '8px 12px' }}>
          <option value="">Todas as gravidades</option>
          {Object.entries(GRAVIDADE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          style={{ padding: '8px 12px' }}>
          <option value="">Todos os estados</option>
          {Object.entries(ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: '60px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : eventos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center" style={{ padding: '60px 24px' }}>
          <p className="text-sm text-slate-400">Sem eventos adversos registados</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {eventos.map(ev => (
            <div key={ev.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '6px' }}>
                    <span className="text-sm font-bold text-slate-800">{TIPO_LABEL[ev.tipo] ?? ev.tipo}</span>
                    <span className={`text-xs font-semibold badge-pad py-0.5 rounded-full border ${GRAVIDADE_COR[ev.gravidade] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      {GRAVIDADE_LABEL[ev.gravidade] ?? ev.gravidade}
                    </span>
                    <span className={`text-xs font-medium badge-pad py-0.5 rounded-full ${ESTADO_COR[ev.estado] ?? 'bg-slate-100 text-slate-500'}`}>
                      {ESTADO_LABEL[ev.estado] ?? ev.estado}
                    </span>
                    {ev.servicoId && (
                      <span className="text-xs text-slate-400 capitalize">{ev.servicoId}</span>
                    )}
                  </div>

                  <p className="text-sm text-slate-700" style={{ marginBottom: '4px' }}>{ev.descricao}</p>

                  <div className="flex items-center gap-3 flex-wrap">
                    {ev.doente && (
                      <span className="text-xs text-slate-500">
                        Doente: <span className="font-medium">{ev.doente.nome}</span>
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(ev.ocorridoEm).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {ev.registadoPor && (
                      <span className="text-xs text-slate-400">· Por {ev.registadoPor.nome}</span>
                    )}
                  </div>

                  {ev.acaoCorretiva && (
                    <div className="bg-blue-50 rounded-xl border border-blue-100" style={{ padding: '10px 12px', marginTop: '10px' }}>
                      <p className="text-xs font-semibold text-blue-700" style={{ marginBottom: '2px' }}>Ação Corretiva</p>
                      <p className="text-xs text-blue-800">{ev.acaoCorretiva}</p>
                    </div>
                  )}
                </div>

                {podeGerir && ev.estado !== 'encerrado' && (
                  <button onClick={() => { setModalAcao(ev); setAcaoTexto(ev.acaoCorretiva ?? ''); setNovoEstado(ev.estado); }}
                    className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors"
                    style={{ padding: '6px 14px' }}>
                    Gerir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Registar Evento */}
      {modalNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalNovo(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '560px', maxHeight: '90vh', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">Registar Evento Adverso</h2>
              <button aria-label="Fechar" onClick={() => setModalNovo(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
              <div>
                <label htmlFor="fpage-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo</label>
                <select id="fpage-0" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ padding: '10px 14px' }}>
                  {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fpage-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Gravidade</label>
                <select id="fpage-1" value={form.gravidade} onChange={e => setForm(f => ({ ...f, gravidade: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ padding: '10px 14px' }}>
                  {Object.entries(GRAVIDADE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
              <div>
                <label htmlFor="fpage-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Serviço</label>
                <select id="fpage-2" value={form.servicoId} onChange={e => setForm(f => ({ ...f, servicoId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ padding: '10px 14px' }}>
                  <option value="">Seleccionar...</option>
                  {SERVICOS.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fpage-3" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Data/Hora</label>
                <input id="fpage-3" type="datetime-local" value={form.ocorridoEm} onChange={e => setForm(f => ({ ...f, ocorridoEm: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ padding: '10px 14px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-4" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Doente (opcional)</label>
              <select id="fpage-4" value={form.doenteId} onChange={e => setForm(f => ({ ...f, doenteId: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ padding: '10px 14px' }}>
                <option value="">Sem doente associado</option>
                {doentesLista.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-5" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Descrição *</label>
              <textarea id="fpage-5" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Descreva o que aconteceu, circunstâncias, local..." rows={3}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                style={{ padding: '10px 14px' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="fpage-6" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Ação Corretiva Imediata (opcional)</label>
              <textarea id="fpage-6" value={form.acaoCorretiva} onChange={e => setForm(f => ({ ...f, acaoCorretiva: e.target.value }))}
                placeholder="Medidas tomadas imediatamente após o evento..." rows={2}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                style={{ padding: '10px 14px' }} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalNovo(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={criar} disabled={mutCriar.isPending || !form.descricao.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {mutCriar.isPending ? 'A guardar...' : 'Registar Evento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Gerir Ação */}
      {modalAcao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalAcao(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '500px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">Gerir Evento Adverso</h2>
              <button aria-label="Fechar" onClick={() => setModalAcao(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fpage-7" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Estado</label>
              <select id="fpage-7" value={novoEstado} onChange={e => setNovoEstado(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ padding: '10px 14px' }}>
                {Object.entries(ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="fpage-8" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Ação Corretiva</label>
              <textarea id="fpage-8" value={acaoTexto} onChange={e => setAcaoTexto(e.target.value)}
                placeholder="Descreva as ações corretivas e preventivas tomadas..." rows={4}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                style={{ padding: '10px 14px' }} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalAcao(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={guardarAcao} disabled={mutAcao.isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {mutAcao.isPending ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
