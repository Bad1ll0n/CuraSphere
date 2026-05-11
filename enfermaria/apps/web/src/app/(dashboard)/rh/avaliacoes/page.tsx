'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';

interface Avaliacao {
  id: string;
  periodo: string;
  dataAvaliacao: string;
  pontuacaoGeral: number;
  pontosFortes?: string;
  areasMelhoria?: string;
  observacoes?: string;
  estado: string;
  utilizador: { id: string; nome: string; role: string; servico?: string };
  avaliador: { id: string; nome: string };
}

interface Colaborador { id: string; nome: string; role: string; }

const ESTADO_COR: Record<string, string> = {
  rascunho:   'bg-amber-50 text-amber-700 border-amber-200',
  finalizada: 'bg-blue-50 text-blue-700 border-blue-200',
  assinada:   'bg-green-50 text-green-700 border-green-200',
};
const ESTADO_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', finalizada: 'Finalizada', assinada: 'Assinada',
};

const ROLE_LABEL: Record<string, string> = {
  medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
  tecnico_saude: 'Técnico de Saúde', farmaceutico: 'Farmacêutico',
  administrativo: 'Administrativo', operacional: 'Operacional',
  ti: 'TI', qualidade: 'Qualidade', direcao: 'Direção',
};

function Estrelas({ valor }: { valor: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <svg key={n} className={`w-4 h-4 ${n <= valor ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

const PERIODOS = ['2026-Anual', '2026-S1', '2026-S2', '2025-Anual', '2025-S1', '2025-S2'];

export default function AvaliacoesPage() {
  const qc = useQueryClient();
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Avaliacao | null>(null);
  const [form, setForm] = useState({
    utilizadorId: '', periodo: '2026-Anual', dataAvaliacao: new Date().toISOString().split('T')[0],
    pontuacaoGeral: 3, pontosFortes: '', areasMelhoria: '', observacoes: '',
  });

  const { data: avaliacoes = [], isLoading } = useQuery<Avaliacao[]>({
    queryKey: ['rh-avaliacoes', filtroPeriodo, filtroEstado],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filtroPeriodo) params.set('periodo', filtroPeriodo);
      if (filtroEstado) params.set('estado', filtroEstado);
      return api.get(`/rh/avaliacoes?${params}`).then(r => r.data);
    },
    staleTime: 30_000,
  });

  const { data: colaboradores = [] } = useQuery<Colaborador[]>({
    queryKey: ['colaboradores-lista'],
    queryFn: () => api.get('/utilizadores').then(r => Array.isArray(r.data) ? r.data : r.data.utilizadores ?? []),
    staleTime: 300_000,
  });

  const mutCriar = useMutation({
    mutationFn: (dto: typeof form) => api.post('/rh/avaliacoes', dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rh-avaliacoes'] }); setModal(false); },
  });

  const mutAtualizar = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<typeof form> & { estado?: string } }) =>
      api.patch(`/rh/avaliacoes/${id}`, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rh-avaliacoes'] }); setEditando(null); },
  });

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Avaliações de Desempenho</h1>
          <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>Acompanhe e registe avaliações por período e colaborador</p>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          style={{ padding: '10px 18px' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Avaliação
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3" style={{ marginBottom: '20px' }}>
        <select value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)}
          className="border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ padding: '9px 14px' }}>
          <option value="">Todos os períodos</option>
          {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ padding: '9px 14px' }}>
          <option value="">Todos os estados</option>
          <option value="rascunho">Rascunho</option>
          <option value="finalizada">Finalizada</option>
          <option value="assinada">Assinada</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center" style={{ padding: '60px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : avaliacoes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center" style={{ padding: '60px' }}>
          <p className="text-sm text-slate-400">Sem avaliações registadas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {avaliacoes.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: '8px' }}>
                    <p className="text-sm font-semibold text-slate-800">{a.utilizador.nome}</p>
                    <span className="text-xs text-slate-400">{ROLE_LABEL[a.utilizador.role] ?? a.utilizador.role}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-medium text-slate-600">{a.periodo}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ESTADO_COR[a.estado]}`}>
                      {ESTADO_LABEL[a.estado]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Estrelas valor={a.pontuacaoGeral} />
                    <span className="text-xs text-slate-400">Avaliado por {a.avaliador.nome} · {new Date(a.dataAvaliacao).toLocaleDateString('pt-PT')}</span>
                  </div>
                  {a.pontosFortes && (
                    <p className="text-xs text-slate-600" style={{ marginTop: '8px' }}>
                      <span className="font-semibold text-green-700">+</span> {a.pontosFortes}
                    </p>
                  )}
                  {a.areasMelhoria && (
                    <p className="text-xs text-slate-600" style={{ marginTop: '4px' }}>
                      <span className="font-semibold text-amber-700">△</span> {a.areasMelhoria}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {a.estado === 'rascunho' && (
                    <>
                      <button onClick={() => setEditando(a)}
                        className="text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                        style={{ padding: '6px 12px' }}>Editar</button>
                      <button onClick={() => mutAtualizar.mutate({ id: a.id, dto: { estado: 'finalizada' } })}
                        className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        style={{ padding: '6px 12px' }}>Finalizar</button>
                    </>
                  )}
                  {a.estado === 'finalizada' && (
                    <button onClick={() => mutAtualizar.mutate({ id: a.id, dto: { estado: 'assinada' } })}
                      className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      style={{ padding: '6px 12px' }}>Assinar</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Nova Avaliação */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" style={{ padding: '24px' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full overflow-y-auto" style={{ maxWidth: '520px', padding: '28px', maxHeight: '90vh' }}>
            <h2 className="text-lg font-bold text-slate-900" style={{ marginBottom: '20px' }}>Nova Avaliação</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Colaborador</label>
                <select value={form.utilizadorId} onChange={e => setForm(f => ({ ...f, utilizadorId: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 12px' }}>
                  <option value="">Seleccionar...</option>
                  {colaboradores.map((c: Colaborador) => <option key={c.id} value={c.id}>{c.nome} ({ROLE_LABEL[c.role] ?? c.role})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Período</label>
                  <select value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 12px' }}>
                    {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Data</label>
                  <input type="date" value={form.dataAvaliacao} onChange={e => setForm(f => ({ ...f, dataAvaliacao: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 12px' }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pontuação Geral</label>
                <div className="flex gap-2 items-center" style={{ marginTop: '8px' }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setForm(f => ({ ...f, pontuacaoGeral: n }))}
                      className="transition-transform hover:scale-110">
                      <svg className={`w-7 h-7 ${n <= form.pontuacaoGeral ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </button>
                  ))}
                  <span className="text-sm text-slate-600 ml-2">{form.pontuacaoGeral}/5</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pontos Fortes</label>
                <textarea value={form.pontosFortes} rows={2} onChange={e => setForm(f => ({ ...f, pontosFortes: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ padding: '10px 12px' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Áreas de Melhoria</label>
                <textarea value={form.areasMelhoria} rows={2} onChange={e => setForm(f => ({ ...f, areasMelhoria: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ padding: '10px 12px' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Observações</label>
                <textarea value={form.observacoes} rows={2} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ padding: '10px 12px' }} />
              </div>
            </div>
            <div className="flex justify-end gap-2" style={{ marginTop: '24px' }}>
              <button onClick={() => setModal(false)}
                className="text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '9px 18px' }}>Cancelar</button>
              <button onClick={() => mutCriar.mutate(form)}
                disabled={!form.utilizadorId || mutCriar.isPending}
                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '9px 20px' }}>
                {mutCriar.isPending ? 'A criar...' : 'Criar Avaliação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Avaliação */}
      {editando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" style={{ padding: '24px' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full overflow-y-auto" style={{ maxWidth: '520px', padding: '28px', maxHeight: '90vh' }}>
            <h2 className="text-lg font-bold text-slate-900" style={{ marginBottom: '6px' }}>Editar Avaliação</h2>
            <p className="text-sm text-slate-500" style={{ marginBottom: '20px' }}>{editando.utilizador.nome} · {editando.periodo}</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pontuação Geral</label>
                <div className="flex gap-2 items-center" style={{ marginTop: '8px' }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button"
                      onClick={() => setEditando(e => e ? { ...e, pontuacaoGeral: n } : e)}
                      className="transition-transform hover:scale-110">
                      <svg className={`w-7 h-7 ${n <= editando.pontuacaoGeral ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pontos Fortes</label>
                <textarea value={editando.pontosFortes ?? ''} rows={2}
                  onChange={e => setEditando(ev => ev ? { ...ev, pontosFortes: e.target.value } : ev)}
                  className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ padding: '10px 12px' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Áreas de Melhoria</label>
                <textarea value={editando.areasMelhoria ?? ''} rows={2}
                  onChange={e => setEditando(ev => ev ? { ...ev, areasMelhoria: e.target.value } : ev)}
                  className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ padding: '10px 12px' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Observações</label>
                <textarea value={editando.observacoes ?? ''} rows={2}
                  onChange={e => setEditando(ev => ev ? { ...ev, observacoes: e.target.value } : ev)}
                  className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ padding: '10px 12px' }} />
              </div>
            </div>
            <div className="flex justify-end gap-2" style={{ marginTop: '24px' }}>
              <button onClick={() => setEditando(null)}
                className="text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '9px 18px' }}>Cancelar</button>
              <button
                onClick={() => mutAtualizar.mutate({ id: editando.id, dto: {
                  pontuacaoGeral: editando.pontuacaoGeral,
                  pontosFortes: editando.pontosFortes,
                  areasMelhoria: editando.areasMelhoria,
                  observacoes: editando.observacoes,
                }})}
                disabled={mutAtualizar.isPending}
                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '9px 20px' }}>
                {mutAtualizar.isPending ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
