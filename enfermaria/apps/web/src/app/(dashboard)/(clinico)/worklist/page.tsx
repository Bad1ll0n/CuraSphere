'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

const TIPO_LABELS: Record<string, string> = {
  analise_clinica: 'Análise Clínica', rx: 'Raio-X', eco: 'Ecografia',
  tc: 'TC', rmn: 'RMN', ecg: 'ECG', outro: 'Outro',
};

const TIPO_ICONS: Record<string, string> = {
  analise_clinica: '🧪', rx: '🦴', eco: '🔊', tc: '🧠', rmn: '🌀', ecg: '❤️', outro: '📋',
};

const ESTADO_CFG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  solicitado:          { label: 'Solicitado',    bg: 'bg-blue-50',   text: 'text-blue-700',  dot: 'bg-blue-400' },
  em_progresso:        { label: 'Em progresso',  bg: 'bg-amber-50',  text: 'text-amber-700', dot: 'bg-amber-400' },
  resultado_disponivel:{ label: 'Resultado',     bg: 'bg-green-50',  text: 'text-green-700', dot: 'bg-green-400' },
  cancelado:           { label: 'Cancelado',     bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
};

const MODALIDADES_IMAGEM = ['rx', 'eco', 'tc', 'rmn'];
const isImagem = (tipo: string) => MODALIDADES_IMAGEM.includes(tipo);

export default function WorklistPage() {
  const [exames, setExames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [resultadoModal, setResultadoModal] = useState<any | null>(null);
  const [resultadoTexto, setResultadoTexto] = useState('');
  const [salvandoResultado, setSalvandoResultado] = useState(false);
  // Laudo radiológico estruturado (exames de imagem)
  const [laudoModal, setLaudoModal] = useState<any | null>(null);
  const [laudoId, setLaudoId] = useState<string | null>(null);
  const [laudoTecnica, setLaudoTecnica] = useState('');
  const [laudoAchados, setLaudoAchados] = useState('');
  const [laudoConclusao, setLaudoConclusao] = useState('');
  const [salvandoLaudo, setSalvandoLaudo] = useState(false);

  const carregar = async () => {
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.append('tipo', filtroTipo);
      const r = await api.get(`/exames/worklist?${params}`);
      setExames(r.data);
    } catch { setExames([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, [filtroTipo]);

  const atualizarEstado = async (id: string, estado: string) => {
    setAtualizando(id);
    try {
      await api.patch(`/exames/${id}/estado`, { estado });
      await carregar();
    } finally { setAtualizando(null); }
  };

  const registarResultado = async () => {
    if (!resultadoModal || !resultadoTexto.trim()) return;
    setSalvandoResultado(true);
    try {
      await api.patch(`/exames/${resultadoModal.id}/resultado`, { resultado: resultadoTexto });
      setResultadoModal(null);
      setResultadoTexto('');
      await carregar();
    } finally { setSalvandoResultado(false); }
  };

  const abrirLaudo = async (e: any) => {
    setLaudoModal(e);
    setLaudoId(null); setLaudoTecnica(''); setLaudoAchados(''); setLaudoConclusao('');
    try {
      const r = await api.get(`/radiologia/exame/${e.id}/laudo`);
      const l = r.data?.laudo;
      if (l) {
        setLaudoId(l.id);
        setLaudoTecnica(l.tecnica ?? '');
        setLaudoAchados(l.achados ?? '');
        setLaudoConclusao(l.conclusao ?? '');
      }
    } catch { /* sem laudo ainda */ }
  };

  const guardarLaudo = async (assinar: boolean) => {
    if (!laudoModal || !laudoAchados.trim() || !laudoConclusao.trim()) return;
    setSalvandoLaudo(true);
    try {
      const r = await api.post(`/radiologia/exame/${laudoModal.id}/laudo`, {
        tecnica: laudoTecnica || undefined, achados: laudoAchados, conclusao: laudoConclusao,
      });
      const id = r.data?.id ?? laudoId;
      if (assinar && id) await api.post(`/radiologia/laudo/${id}/assinar`, {});
      setLaudoModal(null);
      await carregar();
    } finally { setSalvandoLaudo(false); }
  };

  const examesFiltrados = filtroEstado
    ? exames.filter(e => e.estado === filtroEstado)
    : exames;

  const counts = {
    solicitado: exames.filter(e => e.estado === 'solicitado').length,
    em_progresso: exames.filter(e => e.estado === 'em_progresso').length,
    urgente: exames.filter(e => e.urgente).length,
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Worklist de Imagiologia</h1>
          <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>
            Exames pendentes e em progresso · {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button onClick={carregar}
          className="inline-flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors"
          style={{ padding: '10px 16px' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: '28px' }}>
        {[
          { label: 'Solicitados', value: counts.solicitado, cor: 'blue' },
          { label: 'Em progresso', value: counts.em_progresso, cor: 'amber' },
          { label: 'Urgentes', value: counts.urgente, cor: 'red' },
        ].map(({ label, value, cor }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold text-${cor}-600`} style={{ marginTop: '4px' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: '20px' }}>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFiltroEstado('')}
            className={`text-sm font-semibold filter-pad py-2 rounded-lg border transition-colors ${filtroEstado === '' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            Todos
          </button>
          {['solicitado', 'em_progresso'].map(e => (
            <button key={e} onClick={() => setFiltroEstado(e)}
              className={`text-sm font-semibold filter-pad py-2 rounded-lg border transition-colors ${filtroEstado === e ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              {ESTADO_CFG[e]?.label}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-slate-200" />
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFiltroTipo('')}
            className={`text-sm font-semibold filter-pad py-2 rounded-lg border transition-colors ${filtroTipo === '' ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-200 text-slate-600 hover:border-sky-300'}`}>
            Todos os tipos
          </button>
          {Object.entries(TIPO_LABELS).map(([v, l]) => (
            <button key={v} onClick={() => setFiltroTipo(v)}
              className={`text-sm font-semibold filter-pad py-2 rounded-lg border transition-colors ${filtroTipo === v ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-200 text-slate-600 hover:border-sky-300'}`}>
              {TIPO_ICONS[v]} {l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 text-slate-400" style={{ paddingTop: '80px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar worklist...</span>
        </div>
      ) : examesFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center" style={{ padding: '80px 0' }}>
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center" style={{ marginBottom: '16px' }}>
            <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm font-medium">Sem exames pendentes</p>
          <p className="text-slate-300 text-xs" style={{ marginTop: '4px' }}>A worklist está limpa</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {examesFiltrados.map(e => {
            const cfg = ESTADO_CFG[e.estado] ?? ESTADO_CFG.solicitado;
            const isUpdating = atualizando === e.id;
            return (
              <div key={e.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Tipo ícone */}
                    <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center shrink-0 text-lg">
                      {TIPO_ICONS[e.tipo] ?? '📋'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2" style={{ marginBottom: '4px' }}>
                        <span className="text-sm font-bold text-slate-800">{TIPO_LABELS[e.tipo] ?? e.tipo}</span>
                        {e.urgente && (
                          <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 badge-pad py-0.5 rounded-full">URGENTE</span>
                        )}
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium badge-pad py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{e.descricao}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5" style={{ marginTop: '6px' }}>
                        <Link href={`/doentes/${e.doente?.id}`}
                          className="text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors">
                          {e.doente?.nome}
                        </Link>
                        <span className="text-slate-300 text-xs">·</span>
                        <span className="text-xs text-slate-400">Processo {e.doente?.numeroProcesso}</span>
                        {e.doente?.cama && (
                          <>
                            <span className="text-slate-300 text-xs">·</span>
                            <span className="text-xs text-slate-400">Cama {e.doente.cama.numero} · Quarto {e.doente.cama.quarto}</span>
                          </>
                        )}
                        <span className="text-slate-300 text-xs">·</span>
                        <span className="text-xs text-slate-400">
                          Solicitado por {e.solicitadoPor?.nome} · {new Date(e.criadoEm).toLocaleDateString('pt-PT')} {new Date(e.criadoEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {e.estado === 'solicitado' && (
                      <button onClick={() => atualizarEstado(e.id, 'em_progresso')} disabled={isUpdating}
                        className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50"
                        style={{ padding: '7px 14px' }}>
                        {isUpdating ? '...' : 'Iniciar'}
                      </button>
                    )}
                    {['solicitado', 'em_progresso'].includes(e.estado) && (
                      isImagem(e.tipo) ? (
                        <button onClick={() => abrirLaudo(e)}
                          className="text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors"
                          style={{ padding: '7px 14px' }}>
                          Laudo
                        </button>
                      ) : (
                        <button onClick={() => { setResultadoModal(e); setResultadoTexto(''); }}
                          className="text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors"
                          style={{ padding: '7px 14px' }}>
                          Resultado
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Resultado já registado */}
                {e.resultado && (
                  <div className="bg-green-50 rounded-xl border border-green-100" style={{ padding: '12px 16px', marginTop: '12px' }}>
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Resultado</p>
                    <p className="text-sm text-slate-700">{e.resultado}</p>
                    {e.dataResultado && (
                      <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>
                        {new Date(e.dataResultado).toLocaleDateString('pt-PT')} {new Date(e.dataResultado).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Registar Resultado */}
      {resultadoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <h2 className="text-lg font-bold text-slate-900">Registar Resultado</h2>
              <button onClick={() => setResultadoModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div className="bg-slate-50 rounded-xl" style={{ padding: '12px 16px', marginBottom: '20px' }}>
              <p className="text-sm font-semibold text-slate-700">{TIPO_LABELS[resultadoModal.tipo] ?? resultadoModal.tipo}</p>
              <p className="text-sm text-slate-500">{resultadoModal.descricao}</p>
              <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>Doente: {resultadoModal.doente?.nome}</p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Resultado *</label>
              <textarea value={resultadoTexto} onChange={e => setResultadoTexto(e.target.value)}
                rows={5} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Descreva os achados e resultado do exame..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setResultadoModal(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={registarResultado} disabled={salvandoResultado || !resultadoTexto.trim()}
                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvandoResultado ? 'A guardar...' : 'Guardar Resultado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Laudo Radiológico */}
      {laudoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '560px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <h2 className="text-lg font-bold text-slate-900">Laudo Radiológico</h2>
              <button onClick={() => setLaudoModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div className="bg-slate-50 rounded-xl" style={{ padding: '12px 16px', marginBottom: '20px' }}>
              <p className="text-sm font-semibold text-slate-700">{TIPO_LABELS[laudoModal.tipo] ?? laudoModal.tipo}{laudoModal.urgente && <span className="text-red-600"> · URGENTE</span>}</p>
              <p className="text-sm text-slate-500">{laudoModal.descricao}</p>
              <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>Doente: {laudoModal.doente?.nome}</p>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Técnica</label>
              <input value={laudoTecnica} onChange={e => setLaudoTecnica(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                style={{ padding: '10px 14px' }} placeholder="Ex: RX tórax, incidência PA" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Achados *</label>
              <textarea value={laudoAchados} onChange={e => setLaudoAchados(e.target.value)} rows={4}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Descrição dos achados imagiológicos..." />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Conclusão *</label>
              <textarea value={laudoConclusao} onChange={e => setLaudoConclusao(e.target.value)} rows={2}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Impressão diagnóstica..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setLaudoModal(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => guardarLaudo(false)} disabled={salvandoLaudo || !laudoAchados.trim() || !laudoConclusao.trim()}
                className="flex-1 border border-sky-200 text-sky-700 font-semibold rounded-xl hover:bg-sky-50 transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvandoLaudo ? '...' : 'Guardar rascunho'}
              </button>
              <button onClick={() => guardarLaudo(true)} disabled={salvandoLaudo || !laudoAchados.trim() || !laudoConclusao.trim()}
                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvandoLaudo ? 'A assinar...' : 'Assinar laudo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
