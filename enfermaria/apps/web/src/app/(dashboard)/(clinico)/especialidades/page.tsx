'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface Sessao {
  id: string;
  tipo: string;
  doenteId: string;
  profissionalId: string;
  data: string;
  duracao: number;
  descricao?: string;
  evolucao?: string;
  estado: string;
  doente?: { id: string; nome: string };
}

interface Doente { id: string; nome: string; }

const SUBROLE_TITULO: Record<string, string> = {
  nutricao_clinica:   'Nutrição Clínica',
  psicologia_clinica: 'Psicologia Clínica',
  reabilitacao_fala:  'Terapia da Fala',
  tae:                'TAE',
};

const ESTADO_COR: Record<string, string> = {
  agendada:  'bg-blue-50 text-blue-700 border-blue-200',
  realizada: 'bg-green-50 text-green-700 border-green-200',
  cancelada: 'bg-slate-100 text-slate-500 border-slate-200',
  faltou:    'bg-amber-50 text-amber-700 border-amber-200',
};

const ESTADO_LABEL: Record<string, string> = {
  agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada', faltou: 'Faltou',
};

export default function EspecialidadesPage() {
  const { utilizador } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const subRole = utilizador?.subRole ?? '';
  const titulo = SUBROLE_TITULO[subRole] ?? 'Especialidades';

  const [modal, setModal] = useState<'nova' | 'evolucao' | null>(null);
  const [sessaoSel, setSessaoSel] = useState<Sessao | null>(null);
  const [form, setForm] = useState({ doenteId: '', data: '', duracao: 60, descricao: '' });
  const [evolucaoText, setEvolucaoText] = useState('');

  const { data: sessoes = [], isLoading } = useQuery<Sessao[]>({
    queryKey: ['especialidades', subRole],
    queryFn: () => api.get('/especialidades').then(r => r.data),
    staleTime: 30_000,
  });

  const { data: doentes = [] } = useQuery<Doente[]>({
    queryKey: ['doentes-lista-simples'],
    queryFn: () => api.get('/doentes').then(r => Array.isArray(r.data) ? r.data : r.data.doentes ?? []),
    staleTime: 60_000,
  });

  const mutCriar = useMutation({
    mutationFn: (dto: typeof form) => api.post('/especialidades', dto),
    onSuccess: () => { toast.success('Sessão agendada com sucesso'); qc.invalidateQueries({ queryKey: ['especialidades'] }); setModal(null); setForm({ doenteId: '', data: '', duracao: 60, descricao: '' }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao agendar sessão'),
  });

  const mutRealizar = useMutation({
    mutationFn: ({ id, evolucao }: { id: string; evolucao: string }) => api.patch(`/especialidades/${id}/realizar`, { evolucao }),
    onSuccess: () => { toast.success('Evolução registada'); qc.invalidateQueries({ queryKey: ['especialidades'] }); setModal(null); setSessaoSel(null); setEvolucaoText(''); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao registar evolução'),
  });

  const mutCancelar = useMutation({
    mutationFn: (id: string) => api.patch(`/especialidades/${id}/cancelar`),
    onSuccess: () => { toast.success('Sessão cancelada'); qc.invalidateQueries({ queryKey: ['especialidades'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao cancelar sessão'),
  });

  const agendadas = sessoes.filter(s => s.estado === 'agendada');
  const realizadas = sessoes.filter(s => s.estado === 'realizada');

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
          <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>Gestão de sessões e evolução clínica</p>
        </div>
        <button
          onClick={() => setModal('nova')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          style={{ padding: '10px 18px' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Sessão
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: '28px' }}>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl" style={{ padding: '18px 20px' }}>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Sessões Agendadas</p>
          <p className="text-2xl font-bold text-blue-700" style={{ marginTop: '4px' }}>{agendadas.length}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-2xl" style={{ padding: '18px 20px' }}>
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Sessões Realizadas</p>
          <p className="text-2xl font-bold text-green-700" style={{ marginTop: '4px' }}>{realizadas.length}</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-2xl" style={{ padding: '18px 20px' }}>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Total Doentes</p>
          <p className="text-2xl font-bold text-slate-700" style={{ marginTop: '4px' }}>
            {new Set(sessoes.map(s => s.doenteId)).size}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center" style={{ padding: '60px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Sessões agendadas */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700" style={{ marginBottom: '12px' }}>Próximas Sessões</h2>
            {agendadas.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center" style={{ padding: '40px' }}>
                <p className="text-sm text-slate-400">Sem sessões agendadas</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {agendadas.map(s => (
                  <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4" style={{ padding: '16px 20px' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                        <p className="text-sm font-semibold text-slate-800">{s.doente?.nome ?? s.doenteId}</p>
                        <span className={`text-xs font-medium badge-pad py-0.5 rounded-full border ${ESTADO_COR[s.estado]}`}>
                          {ESTADO_LABEL[s.estado]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {new Date(s.data).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {s.duracao} min
                        {s.descricao && ` · ${s.descricao}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setSessaoSel(s); setModal('evolucao'); }}
                        className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        style={{ padding: '7px 14px' }}>
                        Registar
                      </button>
                      <button
                        onClick={() => mutCancelar.mutate(s.id)}
                        className="text-xs font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                        style={{ padding: '7px 12px' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Historial */}
          {realizadas.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700" style={{ marginBottom: '12px' }}>Historial de Sessões</h2>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-50">
                  {realizadas.slice(0, 20).map(s => (
                    <div key={s.id} className="flex items-start gap-4" style={{ padding: '14px 20px' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                          <p className="text-sm font-medium text-slate-800">{s.doente?.nome ?? s.doenteId}</p>
                          <span className={`text-xs font-medium badge-pad py-0.5 rounded-full border ${ESTADO_COR[s.estado]}`}>
                            {ESTADO_LABEL[s.estado]}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {new Date(s.data).toLocaleDateString('pt-PT')} · {s.duracao} min
                        </p>
                        {s.evolucao && (
                          <p className="text-xs text-slate-600 bg-slate-50 rounded-lg" style={{ marginTop: '6px', padding: '8px 10px' }}>{s.evolucao}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modal: Nova Sessão */}
      {modal === 'nova' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" style={{ padding: '24px' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full" style={{ maxWidth: '480px', padding: '28px' }}>
            <h2 className="text-lg font-bold text-slate-900" style={{ marginBottom: '20px' }}>Nova Sessão — {titulo}</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Doente</label>
                <select
                  value={form.doenteId}
                  onChange={e => setForm(f => ({ ...f, doenteId: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 12px' }}>
                  <option value="">Seleccionar doente...</option>
                  {doentes.map((d: Doente) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Data e Hora</label>
                  <input type="datetime-local" value={form.data}
                    onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 12px' }} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Duração (min)</label>
                  <input type="number" value={form.duracao} min={15} max={180} step={15}
                    onChange={e => setForm(f => ({ ...f, duracao: +e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 12px' }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Descrição / Objectivos</label>
                <textarea value={form.descricao} rows={3}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ padding: '10px 12px' }} />
              </div>
            </div>
            <div className="flex justify-end gap-2" style={{ marginTop: '24px' }}>
              <button onClick={() => setModal(null)}
                className="text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '9px 18px' }}>Cancelar</button>
              <button
                onClick={() => mutCriar.mutate(form)}
                disabled={!form.doenteId || !form.data || mutCriar.isPending}
                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '9px 20px' }}>
                {mutCriar.isPending ? 'A agendar...' : 'Agendar Sessão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registar Evolução */}
      {modal === 'evolucao' && sessaoSel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" style={{ padding: '24px' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full" style={{ maxWidth: '480px', padding: '28px' }}>
            <h2 className="text-lg font-bold text-slate-900" style={{ marginBottom: '8px' }}>Registar Evolução</h2>
            <p className="text-sm text-slate-500" style={{ marginBottom: '20px' }}>
              {sessaoSel.doente?.nome} · {new Date(sessaoSel.data).toLocaleDateString('pt-PT')}
            </p>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Notas de Evolução</label>
              <textarea value={evolucaoText} rows={5}
                onChange={e => setEvolucaoText(e.target.value)}
                placeholder="Descreva a evolução clínica, resposta ao tratamento, próximos objectivos..."
                className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ padding: '10px 12px' }} />
            </div>
            <div className="flex justify-end gap-2" style={{ marginTop: '20px' }}>
              <button onClick={() => { setModal(null); setSessaoSel(null); }}
                className="text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '9px 18px' }}>Cancelar</button>
              <button
                onClick={() => mutRealizar.mutate({ id: sessaoSel.id, evolucao: evolucaoText })}
                disabled={!evolucaoText.trim() || mutRealizar.isPending}
                className="text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '9px 20px' }}>
                {mutRealizar.isPending ? 'A guardar...' : 'Marcar como Realizada'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
