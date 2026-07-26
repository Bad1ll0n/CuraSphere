'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface ResultadoAnalise {
  id: string;
  parametro: string;
  valor: number;
  unidade: string;
  refMin: number | null;
  refMax: number | null;
  alterado: boolean;
  critico: boolean;
  painel: string | null;
  observacoes: string | null;
  registadoEm: string;
  registadoPor: { nome: string; role: string } | null;
}

interface Resumo {
  totalResultados: number;
  paineis: string[];
  criticos: ResultadoAnalise[];
  alterados: ResultadoAnalise[];
  ultimoRegisto: string | null;
}

const PAINEIS = ['hemograma', 'bioquimica', 'coagulacao', 'microbiologia'];
const PAINEL_LABEL: Record<string, string> = {
  hemograma: 'Hemograma',
  bioquimica: 'Bioquímica',
  coagulacao: 'Coagulação',
  microbiologia: 'Microbiologia',
};

export function ResultadosLabPanel({ doenteId, utilizador }: { doenteId: string; utilizador: any }) {
  const [resultados, setResultados] = useState<ResultadoAnalise[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [painelAtivo, setPainelAtivo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [modalNovo, setModalNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    parametro: '',
    valor: '',
    unidade: '',
    refMin: '',
    refMax: '',
    critico: false,
    painel: '',
    observacoes: '',
  });

  const podeRegistar = ['medico', 'enfermeiro', 'farmaceutico'].includes(utilizador?.role ?? '');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, rResumo] = await Promise.all([
        api.get(`/exames-lab/doente/${doenteId}${painelAtivo ? `?painel=${painelAtivo}` : ''}`),
        api.get(`/exames-lab/doente/${doenteId}/resumo`),
      ]);
      setResultados(rRes.data);
      setResumo(rResumo.data);
    } catch {}
    finally { setLoading(false); }
  }, [doenteId, painelAtivo]);

  useEffect(() => {
    if (aberto) carregar();
  }, [aberto, carregar]);

  const submeter = async () => {
    if (!form.parametro || !form.valor || !form.unidade) return;
    setSalvando(true);
    try {
      const valorNum = parseFloat(form.valor);
      const refMinNum = form.refMin ? parseFloat(form.refMin) : undefined;
      const refMaxNum = form.refMax ? parseFloat(form.refMax) : undefined;
      const alterado = refMinNum != null && refMaxNum != null
        ? valorNum < refMinNum || valorNum > refMaxNum
        : false;

      await api.post('/exames-lab', {
        doenteId,
        parametro: form.parametro,
        valor: valorNum,
        unidade: form.unidade,
        refMin: refMinNum,
        refMax: refMaxNum,
        alterado,
        critico: form.critico,
        painel: form.painel || undefined,
        observacoes: form.observacoes || undefined,
      });
      setModalNovo(false);
      setForm({ parametro: '', valor: '', unidade: '', refMin: '', refMax: '', critico: false, painel: '', observacoes: '' });
      carregar();
    } catch {}
    finally { setSalvando(false); }
  };

  const temCriticos = (resumo?.criticos?.length ?? 0) > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ marginBottom: '24px' }}>
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center justify-between text-left"
        style={{ padding: '20px 24px' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Resultados Analíticos</span>
            {resumo && resumo.totalResultados > 0 && (
              <span className="text-xs text-slate-400 font-medium bg-slate-50 rounded-full px-2 py-0.5">
                {resumo.totalResultados}
              </span>
            )}
            {temCriticos && (
              <span className="text-xs font-bold bg-red-100 text-red-700 rounded-full px-2 py-0.5 animate-pulse">
                {resumo!.criticos.length} crítico{resumo!.criticos.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {aberto && (
        <div style={{ padding: '0 24px 24px' }}>

          {/* Filtro de painel */}
          <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
            <button
              onClick={() => setPainelAtivo(null)}
              className={`text-xs font-medium rounded-lg border transition-all px-3 py-1.5 ${!painelAtivo ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 text-slate-600 hover:border-teal-300'}`}>
              Todos
            </button>
            {PAINEIS.map(p => (
              <button key={p}
                onClick={() => setPainelAtivo(p === painelAtivo ? null : p)}
                className={`text-xs font-medium rounded-lg border transition-all px-3 py-1.5 ${painelAtivo === p ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 text-slate-600 hover:border-teal-300'}`}>
                {PAINEL_LABEL[p] ?? p}
              </button>
            ))}
            {podeRegistar && (
              <button
                onClick={() => setModalNovo(true)}
                className="ml-auto text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors px-3 py-1.5">
                + Registar resultado
              </button>
            )}
          </div>

          {/* Alertas críticos no topo */}
          {temCriticos && !painelAtivo && (
            <div className="rounded-xl border border-red-200 bg-red-50" style={{ padding: '12px 16px', marginBottom: '16px' }}>
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Valores Críticos</p>
              <div className="flex flex-wrap gap-2">
                {resumo!.criticos.map(r => (
                  <span key={r.id} className="text-xs font-semibold bg-red-100 text-red-800 rounded-lg px-2 py-1 border border-red-200">
                    {r.parametro}: {r.valor} {r.unidade}
                  </span>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-8">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              A carregar...
            </div>
          ) : resultados.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Sem resultados analíticos registados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pr-4">Parâmetro</th>
                    <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pr-4">Valor</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pr-4">Referência</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pr-4">Painel</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map(r => (
                    <tr key={r.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${r.critico ? 'bg-red-50/40' : r.alterado ? 'bg-amber-50/30' : ''}`}>
                      <td className="py-2.5 pr-4 font-medium text-slate-800">
                        {r.critico && <span className="text-red-500 mr-1 text-xs font-bold">!</span>}
                        {r.parametro}
                      </td>
                      <td className={`py-2.5 pr-4 text-right font-mono font-semibold ${r.critico ? 'text-red-600' : r.alterado ? 'text-amber-600' : 'text-slate-700'}`}>
                        {r.valor} <span className="text-slate-400 font-normal text-xs">{r.unidade}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-slate-400 font-mono">
                        {r.refMin != null && r.refMax != null ? `${r.refMin}–${r.refMax}` : '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        {r.painel ? (
                          <span className="text-xs bg-slate-100 text-slate-600 rounded-md px-2 py-0.5">
                            {PAINEL_LABEL[r.painel] ?? r.painel}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 text-xs text-slate-400">
                        {new Date(r.registadoEm).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Novo Resultado */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '480px', padding: '32px', maxHeight: '90vh', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Registar Resultado Analítico</h2>
              <button aria-label="Fechar" onClick={() => setModalNovo(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '16px' }}>
              <div className="col-span-2">
                <label htmlFor="fresultad-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Parâmetro *</label>
                <input id="fresultad-0" value={form.parametro} onChange={e => setForm(f => ({ ...f, parametro: e.target.value }))}
                  placeholder="Ex: Hemoglobina, PCR, Leucócitos..."
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  style={{ padding: '9px 12px' }} />
              </div>
              <div>
                <label htmlFor="fresultad-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Valor *</label>
                <input id="fresultad-1" type="number" step="any" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                  placeholder="0.0"
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  style={{ padding: '9px 12px' }} />
              </div>
              <div>
                <label htmlFor="fresultad-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Unidade *</label>
                <input id="fresultad-2" value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
                  placeholder="g/dL, mmol/L..."
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  style={{ padding: '9px 12px' }} />
              </div>
              <div>
                <label htmlFor="fresultad-3" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Ref. Mínimo</label>
                <input id="fresultad-3" type="number" step="any" value={form.refMin} onChange={e => setForm(f => ({ ...f, refMin: e.target.value }))}
                  placeholder="—"
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  style={{ padding: '9px 12px' }} />
              </div>
              <div>
                <label htmlFor="fresultad-4" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Ref. Máximo</label>
                <input id="fresultad-4" type="number" step="any" value={form.refMax} onChange={e => setForm(f => ({ ...f, refMax: e.target.value }))}
                  placeholder="—"
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  style={{ padding: '9px 12px' }} />
              </div>
              <div className="col-span-2">
                <label htmlFor="fresultad-5" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Painel</label>
                <select id="fresultad-5" value={form.painel} onChange={e => setForm(f => ({ ...f, painel: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  style={{ padding: '9px 12px' }}>
                  <option value="">Sem painel</option>
                  {PAINEIS.map(p => <option key={p} value={p}>{PAINEL_LABEL[p]}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label htmlFor="fresultad-6" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Observações</label>
                <input id="fresultad-6" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Opcional..."
                  className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  style={{ padding: '9px 12px' }} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="critico" checked={form.critico} onChange={e => setForm(f => ({ ...f, critico: e.target.checked }))}
                  className="w-4 h-4 rounded accent-red-600" />
                <label htmlFor="critico" className="text-sm text-red-700 font-semibold cursor-pointer">Marcar como valor crítico</label>
              </div>
            </div>

            <div className="flex gap-3" style={{ marginTop: '8px' }}>
              <button onClick={() => setModalNovo(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={submeter} disabled={salvando || !form.parametro || !form.valor || !form.unidade}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl disabled:opacity-50 transition-colors"
                style={{ padding: '11px' }}>
                {salvando ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
