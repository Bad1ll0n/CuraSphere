'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string; nome: string } | null;
}

export function RiscoEscalasPanel({ doenteId, utilizador }: Props) {
  const toast = useToast();

  const [escalas, setEscalas] = useState<{ braden: any; morse: any }>({ braden: null, morse: null });
  const [modalEscala, setModalEscala] = useState<'braden' | 'morse' | null>(null);
  const [escalaItens, setEscalaItens] = useState<Record<string, number>>({});
  const [salvando, setSalvando] = useState(false);

  const carregarEscalas = () =>
    api.get(`/escalas/${doenteId}`).then((r) => setEscalas(r.data)).catch(() => {});

  useEffect(() => {
    carregarEscalas();
  }, [doenteId]);

  const submeterEscala = async () => {
    if (!modalEscala) return;
    setSalvando(true);
    try {
      await api.post(`/escalas/${doenteId}`, { tipo: modalEscala, itens: escalaItens });
      toast.success('Guardado com sucesso');
      setModalEscala(null); setEscalaItens({});
      carregarEscalas();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvando(false); }
  };

  const riscoConfig: Record<string, { cor: string; label: string }> = {
    muito_alto: { cor: 'bg-red-100 text-red-700',    label: 'Muito Alto' },
    alto:       { cor: 'bg-orange-100 text-orange-700', label: 'Alto' },
    moderado:   { cor: 'bg-yellow-100 text-yellow-700', label: 'Moderado' },
    baixo:      { cor: 'bg-green-100 text-green-700',  label: 'Baixo' },
  };
  const podeAvaliar = ['enfermeiro', 'medico'].includes(utilizador?.role ?? '');

  const bradenItens = [
    { key: 'percepcaoSensorial', label: 'Perceção Sensorial', opcoes: [{ v: 1, l: '1 — Completamente limitada' }, { v: 2, l: '2 — Muito limitada' }, { v: 3, l: '3 — Ligeiramente limitada' }, { v: 4, l: '4 — Sem limitação' }] },
    { key: 'humidade', label: 'Humidade', opcoes: [{ v: 1, l: '1 — Constantemente húmida' }, { v: 2, l: '2 — Muito húmida' }, { v: 3, l: '3 — Ocasionalmente húmida' }, { v: 4, l: '4 — Raramente húmida' }] },
    { key: 'atividade', label: 'Atividade', opcoes: [{ v: 1, l: '1 — Acamado' }, { v: 2, l: '2 — Cadeirante' }, { v: 3, l: '3 — Anda ocasionalmente' }, { v: 4, l: '4 — Anda frequentemente' }] },
    { key: 'mobilidade', label: 'Mobilidade', opcoes: [{ v: 1, l: '1 — Completamente imóvel' }, { v: 2, l: '2 — Muito limitada' }, { v: 3, l: '3 — Ligeiramente limitada' }, { v: 4, l: '4 — Sem limitações' }] },
    { key: 'nutricao', label: 'Nutrição', opcoes: [{ v: 1, l: '1 — Muito pobre' }, { v: 2, l: '2 — Provavelmente inadequada' }, { v: 3, l: '3 — Adequada' }, { v: 4, l: '4 — Excelente' }] },
    { key: 'friccaoCisalhamento', label: 'Fricção e Cisalhamento', opcoes: [{ v: 1, l: '1 — Problema' }, { v: 2, l: '2 — Problema potencial' }, { v: 3, l: '3 — Sem problema' }] },
  ];
  const morseItens = [
    { key: 'historiaQueda', label: 'História de queda nos últimos 3 meses', opcoes: [{ v: 0, l: 'Não — 0 pts' }, { v: 25, l: 'Sim — 25 pts' }] },
    { key: 'diagnosticoSecundario', label: 'Diagnóstico secundário', opcoes: [{ v: 0, l: 'Não — 0 pts' }, { v: 15, l: 'Sim — 15 pts' }] },
    { key: 'ajudaMarcha', label: 'Ajuda na marcha', opcoes: [{ v: 0, l: 'Nenhuma / repouso / cadeira de rodas — 0' }, { v: 15, l: 'Bengala / muleta / andarilho — 15' }, { v: 30, l: 'Apoio em mobiliário — 30' }] },
    { key: 'heparinaIV', label: 'Heparina IV / cateter salinizado', opcoes: [{ v: 0, l: 'Não — 0 pts' }, { v: 20, l: 'Sim — 20 pts' }] },
    { key: 'marchaTransferencia', label: 'Marcha / transferência', opcoes: [{ v: 0, l: 'Normal / repouso / imóvel — 0' }, { v: 10, l: 'Débil — 10' }, { v: 20, l: 'Comprometida — 20' }] },
    { key: 'estadoMental', label: 'Estado mental', opcoes: [{ v: 0, l: 'Consciente das limitações — 0' }, { v: 15, l: 'Sobrestima capacidades — 15' }] },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>
        {(['braden', 'morse'] as const).map((tipo) => {
          const av = tipo === 'braden' ? escalas.braden : escalas.morse;
          const titulo = tipo === 'braden' ? 'Escala de Braden' : 'Escala de Morse';
          const subtitulo = tipo === 'braden' ? 'Risco úlceras de pressão' : 'Risco de queda';
          return (
            <div key={tipo} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-slate-700">{titulo}</span>
                  <p className="text-xs text-slate-400">{subtitulo}</p>
                </div>
                {podeAvaliar && (
                  <button
                    onClick={() => { setEscalaItens({}); setModalEscala(tipo); }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors"
                    style={{ padding: '4px 10px' }}>
                    + Avaliar
                  </button>
                )}
              </div>
              {av ? (
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-slate-900">{av.pontuacao}</div>
                    <div className="text-xs text-slate-400" style={{ marginTop: '2px' }}>pontos</div>
                  </div>
                  <div className="flex-1">
                    <span className={`inline-block text-xs font-bold badge-pad py-1 rounded-full ${riscoConfig[av.risco]?.cor ?? 'bg-slate-100 text-slate-600'}`}>
                      {riscoConfig[av.risco]?.label ?? av.risco}
                    </span>
                    <p className="text-xs text-slate-400" style={{ marginTop: '6px' }}>
                      Avaliado por {av.registadoPor?.nome?.split(' ')[0]} · {new Date(av.criadaEm).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem avaliação registada</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Avaliação de Escala */}
      {modalEscala && (() => {
        const isBraden = modalEscala === 'braden';
        const itensConfig = isBraden ? bradenItens : morseItens;
        const total = itensConfig.reduce((s, it) => s + (escalaItens[it.key] ?? 0), 0);
        const preenchido = itensConfig.every((it) => escalaItens[it.key] !== undefined);

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '560px', padding: '32px', maxHeight: '90vh' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                <h2 className="text-xl font-bold text-slate-900">
                  {isBraden ? 'Escala de Braden' : 'Escala de Morse'}
                </h2>
                <button onClick={() => setModalEscala(null)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-sm text-slate-400" style={{ marginBottom: '24px' }}>
                {isBraden ? 'Avaliação do risco de úlceras de pressão (6–23 pts)' : 'Avaliação do risco de queda (0–125 pts)'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                {itensConfig.map((item) => (
                  <div key={item.key}>
                    <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: '6px' }}>{item.label}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {item.opcoes.map((op) => (
                        <button key={op.v} type="button"
                          onClick={() => setEscalaItens((prev) => ({ ...prev, [item.key]: op.v }))}
                          className={`text-left text-sm rounded-lg border transition-all ${escalaItens[item.key] === op.v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:border-indigo-300'}`}
                          style={{ padding: '8px 12px' }}>
                          {op.l}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 rounded-xl flex items-center justify-between" style={{ padding: '14px 18px', marginBottom: '20px' }}>
                <span className="text-sm font-semibold text-slate-600">Pontuação total</span>
                <span className="text-2xl font-bold text-indigo-700">{total}</span>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setModalEscala(null)}
                  className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  style={{ padding: '11px' }}>
                  Cancelar
                </button>
                <button onClick={submeterEscala} disabled={salvando || !preenchido}
                  className="flex-1 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  style={{ padding: '11px' }}>
                  {salvando ? 'A guardar...' : 'Guardar Avaliação'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
