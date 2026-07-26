'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface Interconsulta {
  id: string;
  especialidadeAlvo: string;
  motivo: string;
  urgente: boolean;
  estado: 'pendente' | 'aceite' | 'respondida' | 'cancelada';
  criadaEm: string;
  respondidaEm?: string;
  resposta?: string;
  doente: { id: string; nome: string; cama?: { numero: string; quarto: string } };
  requisitante: { id: string; nome: string; role: string };
  medicoResposta?: { id: string; nome: string };
}

const ESPECIALIDADES = [
  'Cardiologia', 'Neurologia', 'Pneumologia', 'Nefrologia', 'Gastroenterologia',
  'Endocrinologia', 'Ortopedia', 'Cirurgia Geral', 'Urologia', 'Ginecologia',
  'Hematologia', 'Oncologia', 'Reumatologia', 'Dermatologia', 'Psiquiatria',
  'Oftalmologia', 'Otorrinolaringologia', 'Medicina Interna', 'Anestesiologia',
];

const ESTADO_LABEL: Record<string, string> = {
  pendente: 'Pendente', aceite: 'Aceite', respondida: 'Respondida', cancelada: 'Cancelada',
};

export default function InterconsultasPage() {
  const { utilizador } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [aba, setAba] = useState<'recebidas' | 'enviadas'>('recebidas');
  const [modalNova, setModalNova] = useState(false);
  const [novaDoenteId, setNovaDoenteId] = useState('');
  const [novaEspecialidade, setNovaEspecialidade] = useState('Cardiologia');
  const [novaMotivo, setNovaMotivo] = useState('');
  const [novaUrgente, setNovaUrgente] = useState(false);
  const [modalResposta, setModalResposta] = useState<string | null>(null);
  const [textoResposta, setTextoResposta] = useState('');

  const role = utilizador?.role ?? '';
  const subRole = utilizador?.subRole ?? '';
  const eMedico = role === 'medico';

  const { data = {}, isLoading: loading } = useQuery({
    queryKey: ['interconsultas', subRole],
    queryFn: async () => {
      const [recRes, envRes] = await Promise.all([
        api.get(`/interconsultas/pendentes?especialidade=${encodeURIComponent(subRole || '')}`).catch(() => ({ data: [] })),
        api.get('/interconsultas/minhas').catch(() => ({ data: [] })),
      ]);
      return { recebidas: recRes.data ?? [], enviadas: envRes.data ?? [] };
    },
    staleTime: 30_000,
  });

  const { data: doentesLista = [] } = useQuery<{ id: string; nome: string }[]>({
    queryKey: ['doentes-lista-interconsultas'],
    queryFn: () => api.get('/doentes?todos=true').then(r => (r.data?.data ?? r.data ?? []).map((d: any) => ({ id: d.id, nome: d.nome }))).catch(() => []),
    enabled: modalNova,
    staleTime: 60_000,
  });

  const recebidas: Interconsulta[] = (data as any).recebidas ?? [];
  const enviadas: Interconsulta[] = (data as any).enviadas ?? [];
  const invalidar = () => qc.invalidateQueries({ queryKey: ['interconsultas'] });

  const mutAceitar = useMutation({
    mutationFn: (id: string) => api.patch(`/interconsultas/${id}/aceitar`),
    onSuccess: () => { toast.success('Interconsulta aceite'); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao aceitar interconsulta'),
  });
  const mutCancelar = useMutation({
    mutationFn: (id: string) => api.patch(`/interconsultas/${id}/cancelar`),
    onSuccess: () => { toast.success('Interconsulta cancelada'); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao cancelar interconsulta'),
  });
  const mutResponder = useMutation({
    mutationFn: ({ id, resposta }: { id: string; resposta: string }) => api.patch(`/interconsultas/${id}/responder`, { resposta }),
    onSuccess: () => { toast.success('Resposta enviada com sucesso'); setModalResposta(null); setTextoResposta(''); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao enviar resposta'),
  });
  const mutNova = useMutation({
    mutationFn: ({ doenteId, body }: { doenteId: string; body: object }) => api.post(`/interconsultas/doente/${doenteId}`, body),
    onSuccess: () => { toast.success('Interconsulta enviada'); setModalNova(false); setNovaDoenteId(''); setNovaMotivo(''); setNovaUrgente(false); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao enviar interconsulta'),
  });

  const pendentesCount = recebidas.filter(i => i.estado === 'pendente').length;

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1024px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Interconsultas</h1>
          <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>
            Pedidos de parecer entre especialidades
          </p>
        </div>
        {eMedico && (
          <button
            onClick={() => setModalNova(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
            style={{ padding: '10px 18px' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Interconsulta
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1" style={{ marginBottom: '24px', width: 'fit-content' }}>
        {([
          { key: 'recebidas', label: 'Recebidas', badge: pendentesCount },
          { key: 'enviadas', label: 'Enviadas', badge: 0 },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setAba(t.key)}
            className={`flex items-center gap-2 text-sm font-medium rounded-lg transition-all ${
              aba === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            style={{ padding: '8px 18px' }}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="text-xs font-bold bg-amber-500 text-white rounded-full badge-pad py-0.5 leading-none">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: '60px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(aba === 'recebidas' ? recebidas : enviadas).length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center" style={{ padding: '60px 24px' }}>
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center" style={{ marginBottom: '12px' }}>
                <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <p className="text-sm text-slate-400">
                {aba === 'recebidas' ? 'Sem interconsultas pendentes para responder' : 'Ainda não enviou interconsultas'}
              </p>
            </div>
          ) : (
            (aba === 'recebidas' ? recebidas : enviadas).map((ic) => (
              <InterconsultaCard
                key={ic.id}
                ic={ic}
                modo={aba}
                eMedico={eMedico}
                onAceitar={() => mutAceitar.mutate(ic.id)}
                onResponder={() => { setModalResposta(ic.id); setTextoResposta(''); }}
                onCancelar={() => mutCancelar.mutate(ic.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Modal: Responder */}
      {modalResposta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalResposta(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '520px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">Responder à Interconsulta</h2>
              <button aria-label="Fechar" onClick={() => setModalResposta(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
            </div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
              Resposta / Parecer Clínico
            </label>
            <textarea
              value={textoResposta}
              onChange={e => setTextoResposta(e.target.value)}
              placeholder="Descreva a sua avaliação e recomendações..."
              rows={5}
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              style={{ padding: '12px 14px', marginBottom: '20px' }}
            />
            <div className="flex gap-3">
              <button onClick={() => setModalResposta(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => modalResposta && mutResponder.mutate({ id: modalResposta, resposta: textoResposta })} disabled={mutResponder.isPending || !textoResposta.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {mutResponder.isPending ? 'A guardar...' : 'Enviar Resposta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nova Interconsulta */}
      {modalNova && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalNova(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '520px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">Nova Interconsulta</h2>
              <button aria-label="Fechar" onClick={() => setModalNova(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Doente</label>
              <select value={novaDoenteId} onChange={e => setNovaDoenteId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ padding: '10px 14px' }}>
                <option value="">Seleccionar doente...</option>
                {doentesLista.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Especialidade Alvo</label>
              <select value={novaEspecialidade} onChange={e => setNovaEspecialidade(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ padding: '10px 14px' }}>
                {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo do Pedido</label>
              <textarea
                value={novaMotivo}
                onChange={e => setNovaMotivo(e.target.value)}
                placeholder="Descreva o motivo da interconsulta..."
                rows={3}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                style={{ padding: '10px 14px' }}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer" style={{ marginBottom: '20px' }}>
              <input type="checkbox" checked={novaUrgente} onChange={e => setNovaUrgente(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500" />
              <span className="text-sm font-medium text-slate-700">Urgente</span>
            </label>

            <div className="flex gap-3">
              <button onClick={() => setModalNova(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => mutNova.mutate({ doenteId: novaDoenteId, body: { especialidadeAlvo: novaEspecialidade, motivo: novaMotivo, urgente: novaUrgente } })} disabled={mutNova.isPending || !novaDoenteId || !novaMotivo.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {mutNova.isPending ? 'A enviar...' : 'Enviar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InterconsultaCard({
  ic, modo, eMedico, onAceitar, onResponder, onCancelar,
}: {
  ic: Interconsulta;
  modo: 'recebidas' | 'enviadas';
  eMedico: boolean;
  onAceitar: () => void;
  onResponder: () => void;
  onCancelar: () => void;
}) {
  const ESTADO_COR: Record<string, string> = {
    pendente: 'bg-amber-50 text-amber-700 border border-amber-200',
    aceite: 'bg-blue-50 text-blue-700 border border-blue-200',
    respondida: 'bg-green-50 text-green-700 border border-green-200',
    cancelada: 'bg-slate-50 text-slate-500 border border-slate-200',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '6px' }}>
            <span className="text-sm font-bold text-slate-800">{ic.especialidadeAlvo}</span>
            {ic.urgente && (
              <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 badge-pad py-0.5 rounded-full">
                Urgente
              </span>
            )}
            <span className={`text-xs font-medium badge-pad py-0.5 rounded-full ${ESTADO_COR[ic.estado] ?? 'bg-slate-100 text-slate-500'}`}>
              {ESTADO_LABEL[ic.estado] ?? ic.estado}
            </span>
          </div>

          {/* Doente */}
          <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <Link href={`/doentes/${ic.doente.id}`}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
              {ic.doente.nome}
            </Link>
            {ic.doente.cama && (
              <span className="text-xs text-slate-400">
                · Cama {ic.doente.cama.numero} {ic.doente.cama.quarto && `(${ic.doente.cama.quarto})`}
              </span>
            )}
          </div>

          {/* Motivo */}
          <p className="text-sm text-slate-600" style={{ marginBottom: '6px' }}>{ic.motivo}</p>

          {/* Meta */}
          <p className="text-xs text-slate-400">
            {modo === 'recebidas' ? `Pedido por ${ic.requisitante?.nome}` : `Para: ${ic.especialidadeAlvo}`}
            {' · '}
            {new Date(ic.criadaEm).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>

          {/* Resposta */}
          {ic.resposta && (
            <div className="bg-green-50 rounded-xl border border-green-100" style={{ padding: '12px 14px', marginTop: '12px' }}>
              <p className="text-xs font-semibold text-green-700" style={{ marginBottom: '3px' }}>
                Resposta de {ic.medicoResposta?.nome}
                {ic.respondidaEm && ` · ${new Date(ic.respondidaEm).toLocaleDateString('pt-PT')}`}
              </p>
              <p className="text-xs text-green-800">{ic.resposta}</p>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-col gap-2 shrink-0">
          {modo === 'recebidas' && eMedico && ic.estado === 'pendente' && (
            <>
              <button onClick={onAceitar}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors"
                style={{ padding: '6px 14px' }}>
                Aceitar
              </button>
              <button onClick={onResponder}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors"
                style={{ padding: '6px 14px' }}>
                Responder
              </button>
            </>
          )}
          {modo === 'recebidas' && eMedico && ic.estado === 'aceite' && (
            <button onClick={onResponder}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors"
              style={{ padding: '6px 14px' }}>
              Responder
            </button>
          )}
          {modo === 'enviadas' && ic.estado === 'pendente' && (
            <button onClick={onCancelar}
              className="text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
              style={{ padding: '6px 14px' }}>
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
