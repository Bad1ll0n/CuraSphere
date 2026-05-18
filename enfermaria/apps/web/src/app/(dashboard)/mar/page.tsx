'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import { useToast } from '../../../components/toast';

const MOTIVOS_NAO_ADMIN = [
  { value: 'recusou', label: 'Recusou tomar' },
  { value: 'contraindicacao', label: 'Contraindicação' },
  { value: 'em_exame', label: 'Em exame / procedimento' },
  { value: 'indisponivel', label: 'Medicamento indisponível' },
  { value: 'outro', label: 'Outro' },
];

interface Registo {
  id: string;
  administradoEm: string;
  administradoPor: { nome: string };
  observacoes?: string;
  verificacao5Certas?: boolean;
  naoAdministrada?: boolean;
  motivoNaoAdmin?: string;
}

interface Medicacao {
  id: string;
  nome: string;
  dose: string;
  via: string;
  frequencia: string;
  iniciadoEm: string;
  estadoValidacao?: string;
  doente: { id: string; nome: string; cama: { numero: string; quarto: string } };
  prescritoPor: { nome: string };
  registos: Registo[];
}

const viaCor: Record<string, string> = {
  oral: 'bg-blue-50 text-blue-700',
  ev: 'bg-purple-50 text-purple-700',
  im: 'bg-orange-50 text-orange-700',
  sc: 'bg-teal-50 text-teal-700',
  sl: 'bg-green-50 text-green-700',
  topica: 'bg-yellow-50 text-yellow-700',
  inalatoria: 'bg-sky-50 text-sky-700',
};

const validacaoCor: Record<string, string> = {
  aprovada: 'text-green-600',
  rejeitada: 'text-red-500',
};

const CERTAS_LABELS = [
  'Doente certo',
  'Medicamento certo',
  'Dose certa',
  'Hora certa',
  'Via certa',
];

function getCertasValues(med: Medicacao | undefined): string[] {
  if (!med) return ['', '', '', '', ''];
  const agora = new Date();
  const horaAtual = agora.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const ultimaAdmin = med.registos[0];
  const tempoDesdeUltima = ultimaAdmin
    ? Math.round((agora.getTime() - new Date(ultimaAdmin.administradoEm).getTime()) / 60000)
    : null;
  const horaObs = tempoDesdeUltima != null
    ? `${horaAtual} · Última: há ${tempoDesdeUltima} min`
    : horaAtual;
  return [
    `${med.doente.nome} · Cama ${med.doente.cama.numero} (Quarto ${med.doente.cama.quarto})`,
    `${med.nome}`,
    `${med.dose}`,
    horaObs,
    med.via.toUpperCase(),
  ];
}

export default function MarPage() {
  const toast = useToast();
  const [medicacoes, setMedicacoes] = useState<Medicacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [administrando, setAdministrando] = useState<string | null>(null);
  const [obs, setObs] = useState('');
  const [modalId, setModalId] = useState<string | null>(null);
  const [certas, setCertas] = useState<boolean[]>([false, false, false, false, false]);
  const [modalNaoAdmin, setModalNaoAdmin] = useState<string | null>(null);
  const [motivoSelecionado, setMotivoSelecionado] = useState('recusou');
  const [motivoOutro, setMotivoOutro] = useState('');
  const [registandoNaoAdmin, setRegistandoNaoAdmin] = useState(false);

  const carregar = () => {
    setLoading(true);
    api.get('/medicacao/mar')
      .then((r) => setMedicacoes(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const abrirModal = (id: string) => {
    setModalId(id);
    setObs('');
    setCertas([false, false, false, false, false]);
  };

  const toggleCerta = (i: number) => {
    setCertas((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  const todasMarcadas = certas.every(Boolean);

  const registarNaoAdmin = async () => {
    if (!modalNaoAdmin) return;
    const motivo = motivoSelecionado === 'outro' ? motivoOutro.trim() : motivoSelecionado;
    if (!motivo) return;
    setRegistandoNaoAdmin(true);
    try {
      await api.post(`/medicacao/${modalNaoAdmin}/nao-administrar`, { motivo });
      toast.success('Não-administração registada');
      setModalNaoAdmin(null);
      setMotivoSelecionado('recusou');
      setMotivoOutro('');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao registar');
    } finally { setRegistandoNaoAdmin(false); }
  };

  const administrar = async () => {
    if (!modalId || !todasMarcadas) return;
    setAdministrando(modalId);
    try {
      await api.post(`/medicacao/${modalId}/administrar`, {
        observacoes: obs || undefined,
        verificacao5Certas: true,
      });
      toast.success('Medicação administrada');
      setModalId(null);
      setObs('');
      setCertas([false, false, false, false, false]);
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao administrar medicação');
    } finally { setAdministrando(null); }
  };

  const porDoente = medicacoes.reduce<Record<string, { doente: Medicacao['doente']; meds: Medicacao[] }>>((acc, m) => {
    const did = m.doente.id;
    if (!acc[did]) acc[did] = { doente: m.doente, meds: [] };
    acc[did].meds.push(m);
    return acc;
  }, {});

  const horaAtual = new Date().getHours();
  const turnoLabel = horaAtual >= 8 && horaAtual < 16 ? 'Manhã (08:00–16:00)'
    : horaAtual >= 16 && horaAtual < 23 ? 'Tarde (16:00–23:00)' : 'Noite (23:00–08:00)';

  const modalMed = medicacoes.find((m) => m.id === modalId);
  const certasValues = getCertasValues(modalMed);

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">MAR — Registo de Administração</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>Turno atual: {turnoLabel}</p>
        </div>
        <button onClick={carregar} className="border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2" style={{ padding: '10px 18px' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {loading ? (
        <div role="status" aria-live="polite" aria-busy="true" aria-label="A carregar MAR"
          className="flex items-center justify-center gap-3 text-slate-400" style={{ padding: '80px' }}>
          <svg className="animate-spin w-5 h-5" aria-hidden="true" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar MAR...</span>
        </div>
      ) : Object.keys(porDoente).length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center" style={{ padding: '80px' }}>
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center" style={{ marginBottom: '16px' }}>
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium" style={{ marginBottom: '4px' }}>Sem medicações para este turno</p>
          <p className="text-slate-400 text-sm">Não tens doentes atribuídos com medicações ativas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.values(porDoente).map(({ doente, meds }) => (
            <div key={doente.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100" style={{ padding: '16px 24px' }}>
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">{doente.cama.numero}</span>
                </div>
                <div>
                  <Link href={`/doentes/${doente.id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                    {doente.nome}
                  </Link>
                  <p className="text-xs text-slate-400">Quarto {doente.cama.quarto} · Cama {doente.cama.numero}</p>
                </div>
                <span className="ml-auto text-xs text-slate-400">{meds.length} medicação{meds.length !== 1 ? 'ões' : ''}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {meds.map((m) => {
                  const ultimaAdmin = m.registos[0];
                  const validacao = m.estadoValidacao;
                  return (
                    <div key={m.id} className="flex items-center gap-4" style={{ padding: '14px 24px' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{m.nome}</span>
                          <span className="text-xs text-slate-500">{m.dose}</span>
                          <span className={`text-xs font-medium rounded-md badge-pad py-0.5 ${viaCor[m.via] ?? 'bg-slate-100 text-slate-600'}`}>{m.via.toUpperCase()}</span>
                          {validacao && (
                            <span className={`text-xs font-medium ${validacaoCor[validacao] ?? 'text-slate-400'}`}>
                              {validacao === 'aprovada' ? '✓ Validada' : '✗ Rejeitada'}
                            </span>
                          )}
                          {ultimaAdmin?.verificacao5Certas && (
                            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 rounded-md badge-pad py-0.5">5✓</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3" style={{ marginTop: '4px' }}>
                          <span className="text-xs text-slate-400">{m.frequencia}</span>
                          {ultimaAdmin && (
                            <span className={`text-xs ${ultimaAdmin.naoAdministrada ? 'text-red-400' : 'text-slate-400'}`}>
                              {ultimaAdmin.naoAdministrada
                                ? `✗ Não administrada (${ultimaAdmin.motivoNaoAdmin}) · ${ultimaAdmin.administradoPor.nome}`
                                : `Última: ${new Date(ultimaAdmin.administradoEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} por ${ultimaAdmin.administradoPor.nome}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={() => abrirModal(m.id)}
                          disabled={validacao === 'rejeitada'}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ padding: '7px 14px' }}>
                          Administrar
                        </button>
                        <button
                          onClick={() => { setModalNaoAdmin(m.id); setMotivoSelecionado('recusou'); setMotivoOutro(''); }}
                          disabled={validacao === 'rejeitada'}
                          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ padding: '7px 14px' }}>
                          Não administrada
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Não administrada */}
      {modalNaoAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}
             onClick={(e) => e.target === e.currentTarget && setModalNaoAdmin(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '420px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
              <h2 className="text-base font-bold text-slate-900">Não administrada — Registar motivo</h2>
              <button onClick={() => setModalNaoAdmin(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-xs text-slate-500" style={{ marginBottom: '20px' }}>
              {medicacoes.find(m => m.id === modalNaoAdmin)?.nome} · {medicacoes.find(m => m.id === modalNaoAdmin)?.doente.nome}
            </p>
            <div className="flex flex-col gap-2" style={{ marginBottom: '20px' }}>
              {MOTIVOS_NAO_ADMIN.map(op => (
                <label key={op.value}
                  className={`flex items-center gap-3 rounded-xl border cursor-pointer transition-colors ${motivoSelecionado === op.value ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                  style={{ padding: '10px 14px' }}>
                  <input type="radio" name="motivo" value={op.value} checked={motivoSelecionado === op.value}
                    onChange={() => setMotivoSelecionado(op.value)} className="accent-red-600" />
                  <span className="text-sm font-medium text-slate-700">{op.label}</span>
                </label>
              ))}
              {motivoSelecionado === 'outro' && (
                <input value={motivoOutro} onChange={e => setMotivoOutro(e.target.value)}
                  placeholder="Descreva o motivo..."
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                  style={{ padding: '10px 14px', marginTop: '4px' }} />
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalNaoAdmin(null)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={registarNaoAdmin}
                disabled={registandoNaoAdmin || (motivoSelecionado === 'outro' && !motivoOutro.trim())}
                className="flex-1 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ padding: '11px' }}>
                {registandoNaoAdmin ? 'A registar...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5 Corretas */}
      {modalId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}
             onClick={(e) => e.target === e.currentTarget && setModalId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '480px', maxHeight: '90vh', padding: '32px', margin: '0 16px' }}>

            {/* Header */}
            <div className="flex items-center gap-3" style={{ marginBottom: '6px' }}>
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Verificação das 5 Corretas</h2>
                <p className="text-xs text-slate-500">{modalMed?.nome} · {modalMed?.doente.nome}</p>
              </div>
            </div>

            {/* Aviso */}
            <div className="rounded-xl text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100" style={{ padding: '10px 14px', marginBottom: '20px', marginTop: '12px' }}>
              Confirme cada item antes de administrar. Todos os 5 devem estar verificados.
            </div>

            {/* Checklist */}
            <div className="flex flex-col gap-3" style={{ marginBottom: '20px' }}>
              {CERTAS_LABELS.map((label, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-3 rounded-xl border cursor-pointer transition-colors ${certas[i] ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                  style={{ padding: '12px 14px' }}
                >
                  <input
                    type="checkbox"
                    checked={certas[i]}
                    onChange={() => toggleCerta(i)}
                    className="mt-0.5 w-4 h-4 accent-emerald-600 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '2px' }}>{label}</p>
                    <p className={`text-sm font-medium truncate ${certas[i] ? 'text-emerald-700' : 'text-slate-700'}`}>{certasValues[i]}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Observações */}
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
              Observações (opcional)
            </label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: Administrado com alimento, doente com dificuldade..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              style={{ padding: '10px 14px', marginBottom: '20px' }}
              rows={2}
            />

            {/* Progresso */}
            <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
              {certas.map((v, i) => (
                <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${v ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              ))}
              <span className="text-xs font-semibold text-slate-500 shrink-0">{certas.filter(Boolean).length}/5</span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalId(null)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button
                onClick={administrar}
                disabled={!todasMarcadas || !!administrando}
                className="flex-1 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ padding: '11px' }}>
                {administrando ? 'A registar...' : todasMarcadas ? 'Confirmar Administração' : `Faltam ${5 - certas.filter(Boolean).length} item${5 - certas.filter(Boolean).length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
