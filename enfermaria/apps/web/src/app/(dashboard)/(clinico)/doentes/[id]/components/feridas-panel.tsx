'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

const TIPOS_FERIDA = [
  { value: 'ulcera_pressao', label: 'Úlcera de Pressão', color: 'bg-red-100 text-red-700' },
  { value: 'ulcera_venosa', label: 'Úlcera Venosa', color: 'bg-orange-100 text-orange-700' },
  { value: 'ulcera_arterial', label: 'Úlcera Arterial', color: 'bg-rose-100 text-rose-700' },
  { value: 'cirurgica', label: 'Cirúrgica', color: 'bg-blue-100 text-blue-700' },
  { value: 'traumatica', label: 'Traumática', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'queimadura', label: 'Queimadura', color: 'bg-amber-100 text-amber-700' },
  { value: 'outra', label: 'Outra', color: 'bg-slate-100 text-slate-600' },
];

const ESTADOS_CICATRIZACAO = [
  { value: 'fase_inflamacao', label: 'Fase Inflamação' },
  { value: 'fase_proliferacao', label: 'Fase Proliferação' },
  { value: 'fase_maturacao', label: 'Fase Maturação' },
  { value: 'cronificada', label: 'Cronificada' },
];

const LEITO_OPTIONS = [
  { value: 'granulacao', label: 'Granulação' },
  { value: 'fibrina', label: 'Fibrina' },
  { value: 'necrose_humida', label: 'Necrose Húmida' },
  { value: 'necrose_seca', label: 'Necrose Seca' },
  { value: 'epitelizacao', label: 'Epitelização' },
  { value: 'misto', label: 'Misto' },
];

const EXSUDADO_VOLUME = [
  { value: 'nenhum', label: 'Nenhum' },
  { value: 'escasso', label: 'Escasso' },
  { value: 'moderado', label: 'Moderado' },
  { value: 'abundante', label: 'Abundante' },
];

const EXSUDADO_TIPO = [
  { value: 'seroso', label: 'Seroso' },
  { value: 'sero_sanguinolento', label: 'Sero-Sanguinolento' },
  { value: 'sanguinolento', label: 'Sanguinolento' },
  { value: 'purulento', label: 'Purulento' },
];

const PERIFERIA_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'eritema', label: 'Eritema' },
  { value: 'edema', label: 'Edema' },
  { value: 'macerada', label: 'Macerada' },
  { value: 'seca', label: 'Seca' },
  { value: 'callosa', label: 'Calosa' },
];

interface AvaliacaoFerida {
  id: string;
  criadaEm: string;
  tipo: string;
  localizacao: string;
  estadoCicatrizacao: string;
  comprimento?: number;
  largura?: number;
  profundidade?: number;
  leito?: string;
  exsudadoVolume?: string;
  exsudadoTipo?: string;
  periferia?: string;
  dor?: number;
  odor: boolean;
  pensoAplicado?: string;
  proximaTroca?: string;
  notas?: string;
  registadoPor: { id: string; nome: string };
}

interface FeridasPanelProps {
  doenteId: string;
  utilizador: { id: string; role: string } | null;
}

const tipoInfo = (tipo: string) => TIPOS_FERIDA.find((t) => t.value === tipo) ?? { label: tipo, color: 'bg-slate-100 text-slate-600' };

function calcTendencia(atual: AvaliacaoFerida, anterior: AvaliacaoFerida | undefined): 'melhor' | 'pior' | 'estavel' {
  if (!anterior) return 'estavel';
  const areaAtual = (atual.comprimento ?? 0) * (atual.largura ?? 0);
  const areaAnt = (anterior.comprimento ?? 0) * (anterior.largura ?? 0);
  const exsudadoOrd = ['nenhum', 'escasso', 'moderado', 'abundante'];
  const exAtual = exsudadoOrd.indexOf(atual.exsudadoVolume ?? 'nenhum');
  const exAnt = exsudadoOrd.indexOf(anterior.exsudadoVolume ?? 'nenhum');

  let score = 0;
  if (areaAtual < areaAnt) score -= 1;
  else if (areaAtual > areaAnt) score += 1;
  if (exAtual < exAnt) score -= 1;
  else if (exAtual > exAnt) score += 1;
  if (!atual.odor && anterior.odor) score -= 1;
  else if (atual.odor && !anterior.odor) score += 1;

  if (score < 0) return 'melhor';
  if (score > 0) return 'pior';
  return 'estavel';
}

const EMPTY_FORM = {
  tipo: 'ulcera_pressao',
  localizacao: '',
  estadoCicatrizacao: 'fase_inflamacao',
  comprimento: '',
  largura: '',
  profundidade: '',
  leito: '',
  exsudadoVolume: '',
  exsudadoTipo: '',
  periferia: '',
  dor: '',
  odor: false as boolean,
  pensoAplicado: '',
  proximaTroca: '',
  notas: '',
};

export function FeridasPanel({ doenteId, utilizador }: FeridasPanelProps) {
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoFerida[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [secaoAtiva, setSecaoAtiva] = useState<'identificacao' | 'caracteristicas' | 'penso' | 'notas'>('identificacao');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [guardando, setGuardando] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const toast = useToast();

  const podeRegistar = ['medico', 'enfermeiro', 'tecnico_saude'].includes(utilizador?.role ?? '');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/feridas/${doenteId}`);
      setAvaliacoes(r.data);
    } catch {
      setAvaliacoes([]);
    } finally {
      setLoading(false);
    }
  }, [doenteId]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirModal = () => {
    setForm({ ...EMPTY_FORM });
    setSecaoAtiva('identificacao');
    setModalAberto(true);
  };

  const submeter = async () => {
    if (!form.localizacao.trim()) { toast.error('Localização obrigatória'); return; }
    setGuardando(true);
    try {
      await api.post(`/feridas/${doenteId}`, {
        tipo: form.tipo,
        localizacao: form.localizacao,
        estadoCicatrizacao: form.estadoCicatrizacao,
        comprimento: form.comprimento ? parseFloat(form.comprimento as string) : undefined,
        largura: form.largura ? parseFloat(form.largura as string) : undefined,
        profundidade: form.profundidade ? parseFloat(form.profundidade as string) : undefined,
        leito: form.leito || undefined,
        exsudadoVolume: form.exsudadoVolume || undefined,
        exsudadoTipo: form.exsudadoTipo || undefined,
        periferia: form.periferia || undefined,
        dor: form.dor !== '' ? parseInt(form.dor as string) : undefined,
        odor: form.odor,
        pensoAplicado: form.pensoAplicado || undefined,
        proximaTroca: form.proximaTroca || undefined,
        notas: form.notas || undefined,
      });
      toast.success('Avaliação registada');
      setModalAberto(false);
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally {
      setGuardando(false);
    }
  };

  const apagar = async (id: string) => {
    try {
      await api.delete(`/feridas/${id}`);
      toast.success('Avaliação removida');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao remover');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ marginTop: '20px' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-rose-500" style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">Feridas e Curativos</h2>
            <p className="text-xs text-slate-400">{avaliacoes.length} avaliação{avaliacoes.length !== 1 ? 'ões' : ''} registada{avaliacoes.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {podeRegistar && (
          <button onClick={abrirModal}
            className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            style={{ padding: '8px 16px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nova Avaliação
          </button>
        )}
      </div>

      {/* Lista */}
      <div style={{ padding: '16px 24px' }}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-slate-400" style={{ padding: '32px' }}>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">A carregar...</span>
          </div>
        ) : avaliacoes.length === 0 ? (
          <div className="text-center" style={{ padding: '40px 16px' }}>
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto" style={{ marginBottom: '12px' }}>
              <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-500">Sem avaliações de feridas</p>
            <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>Registe a primeira avaliação de ferida</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {avaliacoes.map((av, idx) => {
              const anterior = avaliacoes[idx + 1];
              const tendencia = calcTendencia(av, anterior);
              const info = tipoInfo(av.tipo);
              const alerta = av.odor || av.exsudadoTipo === 'purulento';
              const isOpen = expandido === av.id;
              const area = av.comprimento && av.largura ? `${av.comprimento}×${av.largura}${av.profundidade ? `×${av.profundidade}` : ''} cm` : null;

              return (
                <div key={av.id} className="border border-slate-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandido(isOpen ? null : av.id)}
                    className="w-full flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                    style={{ padding: '14px 16px' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Tendência */}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${
                        tendencia === 'melhor' ? 'bg-green-50 text-green-600' :
                        tendencia === 'pior' ? 'bg-red-50 text-red-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {tendencia === 'melhor' ? '↓' : tendencia === 'pior' ? '↑' : '→'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center text-xs font-semibold rounded-lg ${info.color}`} style={{ padding: '2px 8px' }}>
                            {info.label}
                          </span>
                          {alerta && (
                            <span className="text-xs font-semibold text-amber-600 bg-amber-50 rounded-lg" style={{ padding: '2px 8px' }}>
                              ⚠️ Atenção
                            </span>
                          )}
                          <span className="text-xs text-slate-400 font-mono">{estatoLabel(av.estadoCicatrizacao)}</span>
                        </div>
                        <p className="text-sm text-slate-700 font-medium truncate" style={{ marginTop: '2px' }}>{av.localizacao}</p>
                        {area && <p className="text-xs text-slate-400" style={{ marginTop: '1px' }}>{area}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0" style={{ marginLeft: '12px' }}>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">{new Date(av.criadaEm).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                        <p className="text-xs text-slate-300">{av.registadoPor.nome.split(' ')[0]}</p>
                      </div>
                      <svg className={`w-4 h-4 text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100" style={{ padding: '16px' }}>
                      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: alerta || av.notas || av.pensoAplicado ? '16px' : '0' }}>
                        {av.leito && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '2px' }}>Leito</p>
                            <p className="text-sm text-slate-700">{LEITO_OPTIONS.find(l => l.value === av.leito)?.label ?? av.leito}</p>
                          </div>
                        )}
                        {av.exsudadoVolume && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '2px' }}>Exsudado</p>
                            <p className="text-sm text-slate-700">
                              {EXSUDADO_VOLUME.find(e => e.value === av.exsudadoVolume)?.label}
                              {av.exsudadoTipo && ` · ${EXSUDADO_TIPO.find(e => e.value === av.exsudadoTipo)?.label}`}
                            </p>
                          </div>
                        )}
                        {av.periferia && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '2px' }}>Periferia</p>
                            <p className="text-sm text-slate-700">{PERIFERIA_OPTIONS.find(p => p.value === av.periferia)?.label ?? av.periferia}</p>
                          </div>
                        )}
                        {av.dor !== undefined && av.dor !== null && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '2px' }}>Dor (NRS)</p>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-sm font-bold ${av.dor >= 7 ? 'text-red-600' : av.dor >= 4 ? 'text-orange-500' : 'text-green-600'}`}>{av.dor}/10</span>
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '2px' }}>Odor</p>
                          <p className={`text-sm font-medium ${av.odor ? 'text-amber-600' : 'text-slate-500'}`}>{av.odor ? 'Presente' : 'Ausente'}</p>
                        </div>
                      </div>

                      {av.pensoAplicado && (
                        <div style={{ marginBottom: '12px' }}>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '2px' }}>Penso Aplicado</p>
                          <p className="text-sm text-slate-700">{av.pensoAplicado}</p>
                          {av.proximaTroca && (
                            <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>
                              Próxima troca: {new Date(av.proximaTroca).toLocaleDateString('pt-PT')}
                            </p>
                          )}
                        </div>
                      )}

                      {av.notas && (
                        <div className="bg-slate-50 rounded-xl" style={{ padding: '12px', marginBottom: '12px' }}>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Notas</p>
                          <p className="text-sm text-slate-600 whitespace-pre-wrap">{av.notas}</p>
                        </div>
                      )}

                      {podeRegistar && utilizador?.id === av.registadoPor.id && (
                        <div className="flex justify-end">
                          <button onClick={() => apagar(av.id)}
                            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            style={{ padding: '4px 10px' }}>
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Nova Avaliação */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col" style={{ maxWidth: '580px', maxHeight: '90vh', margin: '0 16px' }}>

            {/* Modal header */}
            <div className="flex items-center justify-between shrink-0" style={{ padding: '24px 28px 0' }}>
              <h2 className="text-lg font-bold text-slate-900">Nova Avaliação de Ferida</h2>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 shrink-0" style={{ padding: '0 28px', marginTop: '20px' }}>
              {([
                { key: 'identificacao', label: 'Identificação' },
                { key: 'caracteristicas', label: 'Características' },
                { key: 'penso', label: 'Penso' },
                { key: 'notas', label: 'Notas' },
              ] as const).map((tab) => (
                <button key={tab.key} onClick={() => setSecaoAtiva(tab.key)}
                  className={`text-sm font-medium pb-3 border-b-2 transition-colors ${secaoAtiva === tab.key ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  style={{ marginRight: '24px' }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1" style={{ padding: '24px 28px' }}>

              {/* Secção: Identificação */}
              {secaoAtiva === 'identificacao' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Tipo de Ferida *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {TIPOS_FERIDA.map((t) => (
                        <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
                          className={`text-sm font-medium rounded-xl border text-left transition-all ${form.tipo === t.value ? 'bg-rose-600 text-white border-rose-600' : 'border-slate-200 text-slate-600 hover:border-rose-300'}`}
                          style={{ padding: '9px 12px' }}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Localização *</label>
                    <input type="text" value={form.localizacao} onChange={e => setForm(f => ({ ...f, localizacao: e.target.value }))}
                      placeholder="Ex: Sacro, Calcanhar direito, Maléolo..."
                      className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 transition"
                      style={{ padding: '10px 14px' }} maxLength={300} />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Estado de Cicatrização *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {ESTADOS_CICATRIZACAO.map((e) => (
                        <button key={e.value} type="button" onClick={() => setForm(f => ({ ...f, estadoCicatrizacao: e.value }))}
                          className={`text-sm font-medium rounded-xl border text-left transition-all ${form.estadoCicatrizacao === e.value ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                          style={{ padding: '9px 12px' }}>
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Dimensões (cm) — opcional</label>
                    <div className="flex gap-2">
                      {[
                        { key: 'comprimento', placeholder: 'Compr.' },
                        { key: 'largura', placeholder: 'Larg.' },
                        { key: 'profundidade', placeholder: 'Prof.' },
                      ].map(({ key, placeholder }) => (
                        <input key={key} type="number" min="0" step="0.1"
                          value={(form as any)[key]}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="flex-1 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition"
                          style={{ padding: '10px 10px' }} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>Comprimento × Largura × Profundidade</p>
                  </div>
                </div>
              )}

              {/* Secção: Características */}
              {secaoAtiva === 'caracteristicas' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Leito da Ferida</label>
                    <div className="flex flex-wrap gap-2">
                      {LEITO_OPTIONS.map((l) => (
                        <button key={l.value} type="button" onClick={() => setForm(f => ({ ...f, leito: f.leito === l.value ? '' : l.value }))}
                          className={`text-xs font-semibold rounded-lg border transition-all ${form.leito === l.value ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
                          style={{ padding: '6px 12px' }}>
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Volume de Exsudado</label>
                      <div className="flex flex-col gap-1.5">
                        {EXSUDADO_VOLUME.map((e) => (
                          <button key={e.value} type="button" onClick={() => setForm(f => ({ ...f, exsudadoVolume: f.exsudadoVolume === e.value ? '' : e.value }))}
                            className={`text-xs font-semibold rounded-lg border text-left transition-all ${form.exsudadoVolume === e.value ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                            style={{ padding: '7px 10px' }}>
                            {e.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Tipo de Exsudado</label>
                      <div className="flex flex-col gap-1.5">
                        {EXSUDADO_TIPO.map((e) => (
                          <button key={e.value} type="button" onClick={() => setForm(f => ({ ...f, exsudadoTipo: f.exsudadoTipo === e.value ? '' : e.value }))}
                            className={`text-xs font-semibold rounded-lg border text-left transition-all ${form.exsudadoTipo === e.value ? 'bg-rose-600 text-white border-rose-600' : 'border-slate-200 text-slate-600 hover:border-rose-300'}`}
                            style={{ padding: '7px 10px' }}>
                            {e.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Periferia</label>
                    <div className="flex flex-wrap gap-2">
                      {PERIFERIA_OPTIONS.map((p) => (
                        <button key={p.value} type="button" onClick={() => setForm(f => ({ ...f, periferia: f.periferia === p.value ? '' : p.value }))}
                          className={`text-xs font-semibold rounded-lg border transition-all ${form.periferia === p.value ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
                          style={{ padding: '6px 12px' }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Dor NRS (0–10)</label>
                      <input type="number" min="0" max="10" value={form.dor as string}
                        onChange={e => setForm(f => ({ ...f, dor: e.target.value }))}
                        placeholder="0-10"
                        className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition"
                        style={{ padding: '10px 14px' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Odor</label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setForm(f => ({ ...f, odor: false }))}
                          className={`flex-1 text-xs font-semibold rounded-lg border transition-all ${!form.odor ? 'bg-green-600 text-white border-green-600' : 'border-slate-200 text-slate-600'}`}
                          style={{ padding: '10px' }}>
                          Ausente
                        </button>
                        <button type="button" onClick={() => setForm(f => ({ ...f, odor: true }))}
                          className={`flex-1 text-xs font-semibold rounded-lg border transition-all ${form.odor ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 text-slate-600'}`}
                          style={{ padding: '10px' }}>
                          Presente
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Secção: Penso */}
              {secaoAtiva === 'penso' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Penso Aplicado</label>
                    <input type="text" value={form.pensoAplicado}
                      onChange={e => setForm(f => ({ ...f, pensoAplicado: e.target.value }))}
                      placeholder="Ex: Mepilex Border, Hidrofibra, Alginato..."
                      className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition"
                      style={{ padding: '10px 14px' }} maxLength={200} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Próxima Troca</label>
                    <input type="date" value={form.proximaTroca}
                      onChange={e => setForm(f => ({ ...f, proximaTroca: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition"
                      style={{ padding: '10px 14px' }} />
                  </div>
                </div>
              )}

              {/* Secção: Notas */}
              {secaoAtiva === 'notas' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Notas Adicionais</label>
                  <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                    rows={6} maxLength={2000}
                    placeholder="Observações sobre a evolução, procedimentos realizados, intercorrências..."
                    className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition resize-none"
                    style={{ padding: '10px 14px' }} />
                  <p className="text-xs text-slate-400 text-right" style={{ marginTop: '4px' }}>{form.notas.length}/2000</p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 border-t border-slate-100 shrink-0" style={{ padding: '16px 28px' }}>
              <button onClick={() => setModalAberto(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm"
                style={{ padding: '11px' }}>
                Cancelar
              </button>
              <button onClick={submeter} disabled={guardando || !form.localizacao.trim()}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-50"
                style={{ padding: '11px' }}>
                {guardando ? 'A guardar...' : 'Registar Avaliação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function estatoLabel(e: string) {
  return ESTADOS_CICATRIZACAO.find((s) => s.value === e)?.label ?? e;
}
