'use client';

import { useEffect, useState } from 'react';
import { turnoDaHora } from '@org/shared';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { chavesClinicas, useInvalidarTurno } from '@/lib/hooks';
import type { LinhaMar } from '@org/shared';
import { FaixaAlergiasDoente } from '@/components/faixa-alergias';
import { useToast } from '@/components/toast';
import { useDialogoAcessivel } from '@/components/ui/use-dialogo-acessivel';
import { ErroCarregamento } from '@/components/erro-carregamento';
import { EmptyState } from '@/components/empty-state';
import { pedirTexto } from '@/components/motivo-remocao';
import { LeituraBcma, LEITURA_VAZIA, camposLeitura, leituraBloqueia, type EstadoLeitura } from '@/components/leitura-bcma';
import { RegistoDiferido } from '@/components/registo-diferido';
import { Button } from '@/components/ui';

// UX-07: o texto vem de mar.reason.<valor>.
const MOTIVOS_NAO_ADMIN = ['recusou', 'contraindicacao', 'em_exame', 'indisponivel', 'outro'] as const;

// ARQ-12: a forma da resposta vem do contrato partilhado com a api.
type Medicacao = LinhaMar;

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

type T = ReturnType<typeof useTranslations<'mar'>>;

function getCertasValues(med: Medicacao | undefined, t: T): string[] {
  if (!med) return ['', '', '', '', ''];
  const agora = new Date();
  const horaAtual = agora.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const ultimaAdmin = med.registos[0];
  const tempoDesdeUltima = ultimaAdmin
    ? Math.round((agora.getTime() - new Date(ultimaAdmin.administradoEm).getTime()) / 60000)
    : null;
  const horaObs = tempoDesdeUltima != null
    ? t('lastMinAgo', { hora: horaAtual, min: tempoDesdeUltima })
    : horaAtual;
  return [
    t('patientBedRoom', { nome: med.doente.nome, cama: med.doente.cama?.numero ?? '—', quarto: med.doente.cama?.quarto ?? '—' }),
    `${med.nome}`,
    `${med.dose}`,
    horaObs,
    med.via.toUpperCase(),
  ];
}

export function MarCliente() {
  const toast = useToast();
  const t = useTranslations('mar');
  const tc = useTranslations('common');
  // ARQ-13: react-query. Administrar aqui invalida também "O meu turno" e a faixa do doente.
  const marQ = useQuery<Medicacao[]>({ queryKey: chavesClinicas.mar, queryFn: () => api.get('/medicacao/mar').then((r) => r.data) });
  const medicacoes = marQ.data ?? [];
  const loading = marQ.isLoading;
  const erroCarga = marQ.isError;
  const invalidarTurno = useInvalidarTurno();
  const carregar = () => { void marQ.refetch(); };
  // UX-30: "Administrar" a partir de "O meu turno" abre o MAR já filtrado no doente.
  const [doenteFiltro, setDoenteFiltro] = useState<string | null>(null);
  useEffect(() => { setDoenteFiltro(new URLSearchParams(window.location.search).get('doente')); }, []);
  const [administrando, setAdministrando] = useState<string | null>(null);
  const [obs, setObs] = useState('');
  const [modalId, setModalId] = useState<string | null>(null);
  const [certas, setCertas] = useState<boolean[]>([false, false, false, false, false]);
  const [modalNaoAdmin, setModalNaoAdmin] = useState<string | null>(null);
  const [motivoSelecionado, setMotivoSelecionado] = useState('recusou');
  const [motivoOutro, setMotivoOutro] = useState('');
  const [registandoNaoAdmin, setRegistandoNaoAdmin] = useState(false);

  // Escape, armadilha de foco e devolução do foco nos dois diálogos desta página.
  const dlgNaoAdmin = useDialogoAcessivel({
    aberto: !!modalNaoAdmin,
    onFechar: () => setModalNaoAdmin(null),
    titulo: t('notGivenTitle'),
  });
  const dlg5Certas = useDialogoAcessivel({
    aberto: !!modalId,
    onFechar: () => setModalId(null),
    titulo: t('fiveRightsTitle'),
  });

  // F-08: uma falha de rede não pode terminar no estado vazio — "Sem medicações para este
  // turno" — senão o enfermeiro concluía que não havia nada a administrar (isError abaixo).

  // UX-08: leitura da pulseira e da embalagem à cabeceira.
  const [leitura, setLeitura] = useState<EstadoLeitura>(LEITURA_VAZIA);
  const mudarLeitura = (e: EstadoLeitura) => {
    setLeitura(e);
    setCertas((prev) => prev.map((v, i) => (i === 0 && e.pulseira ? e.pulseira.resultado.ok : i === 1 && e.medicamento ? e.medicamento.resultado.ok : v)));
  };

  const abrirModal = (id: string) => {
    setModalId(id);
    setObs('');
    setCertas([false, false, false, false, false]);
    setLeitura(LEITURA_VAZIA);
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
      toast.success(t('notGivenRecorded'));
      setModalNaoAdmin(null);
      setMotivoSelecionado('recusou');
      setMotivoOutro('');
      invalidarTurno();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t('recordError'));
    } finally { setRegistandoNaoAdmin(false); }
  };

  // QA-08 (SOS) e QA-15 (1.ª dose antes da validação): o servidor pede uma justificação com 409.
  const administrar = async (extra: { justificacaoSOS?: string; justificacaoNaoValidada?: string } = {}) => {
    if (!modalId || !todasMarcadas || leituraBloqueia(leitura)) return;
    setAdministrando(modalId);
    try {
      await api.post(`/medicacao/${modalId}/administrar`, {
        doenteId: modalMed?.doente.id,
        // Atestação, não verificação: o enfermeiro percorreu a lista à cabeceira, mas o
        // sistema não comparou nada. Reenviar aqui a dose e a via que o servidor nos
        // mandou faria com que ele as comparasse consigo próprio e gravasse uma
        // verificação inexistente. A verificação a sério é a da etiqueta lida por QR.
        atestadoPeloEnfermeiro: todasMarcadas,
        observacoes: obs || undefined,
        ...camposLeitura(leitura),
        ...extra,
      });
      toast.success(t('administered'));
      setModalId(null);
      setObs('');
      setCertas([false, false, false, false, false]);
      invalidarTurno();
    } catch (e: any) {
        // QA-08: SOS antes do intervalo mínimo / acima do máximo diário — só com justificação.
        const sos = e?.response?.status === 409 && /^SOS:/.test(e?.response?.data?.message ?? '');
        if (sos) {
          const justificacao = await pedirTexto({
            titulo: t('sosTitle'),
            descricao: e.response.data.message,
            rotulo: t('sosLabel'),
            botao: t('sosButton'),
            placeholder: t('sosPlaceholder'),
          });
          if (justificacao) { setTimeout(() => void administrar({ ...extra, justificacaoSOS: justificacao }), 0); return; }
        }
        // QA-15: prescrição por validar — só a 1.ª dose, urgente e justificada.
        const naoValidada = e?.response?.status === 409 && /justificacaoNaoValidada/.test(e?.response?.data?.message ?? '');
        if (naoValidada) {
          const justificacao = await pedirTexto({
            titulo: t('notValidatedTitle'),
            descricao: e.response.data.message,
            rotulo: t('notValidatedLabel'),
            botao: t('notValidatedButton'),
            placeholder: t('notValidatedPlaceholder'),
          });
          if (justificacao) { setTimeout(() => void administrar({ ...extra, justificacaoNaoValidada: justificacao }), 0); return; }
        }
        toast.error(e?.response?.data?.message ?? t('administerError'));
    } finally { setAdministrando(null); }
  };

  const porDoente = medicacoes.filter((m) => !doenteFiltro || m.doente.id === doenteFiltro).reduce<Record<string, { doente: Medicacao['doente']; meds: Medicacao[] }>>((acc, m) => {
    const did = m.doente.id;
    if (!acc[did]) acc[did] = { doente: m.doente, meds: [] };
    acc[did].meds.push(m);
    return acc;
  }, {});

  const horaAtual = new Date().getHours();
  // UX-12: a definição única dos turnos (libs/shared) — antes a tarde acabava aqui às 23.
  const turnoLabel = t(({ manha: 'shift.morning', tarde: 'shift.afternoon', noite: 'shift.night' } as const)[turnoDaHora(horaAtual)]);

  const modalMed = medicacoes.find((m) => m.id === modalId);
  const certasValues = getCertasValues(modalMed, t);

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('title')}</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>{t('currentShift', { turno: turnoLabel })}</p>
        </div>
        <Button variant="secondary" className="flex gap-2" onClick={carregar}  style={{ padding: '10px 18px' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {tc('refresh')}
        </Button>
      </div>

      {loading ? (
        <div role="status" aria-live="polite" aria-busy="true" aria-label={t('loading')}
          className="flex items-center justify-center gap-3 text-slate-500" style={{ padding: '80px' }}>
          <svg className="animate-spin w-5 h-5" aria-hidden="true" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">{t('loading')}</span>
        </div>
      ) : erroCarga ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <ErroCarregamento
            titulo={t('loadErrorTitle')}
            descricao={t('loadErrorBody')}
            onTentarNovamente={carregar}
          />
        </div>
      ) : Object.keys(porDoente).length === 0 ? (
        // UX-10: sem medicação a mostrar não é um beco sem saída — diz onde ver as atribuições.
        <EmptyState cartao icon="medication" title={t('emptyTitle')} description={t('emptyBody')}
          acoes={[{ label: t('emptyActionAssignments'), href: '/atribuicoes' }, { label: t('emptyActionPatients'), href: '/doentes' }]} />
      ) : (
        <div className="flex flex-col gap-6">
          {doenteFiltro && (
            <button type="button" onClick={() => { setDoenteFiltro(null); window.history.replaceState(null, '', '/mar'); }}
              className="self-start text-sm font-semibold text-blue-700 hover:underline">
              {t('showAllPatients')}
            </button>
          )}
          {Object.values(porDoente).map(({ doente, meds }) => (
            <div key={doente.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100" style={{ padding: '16px 24px' }}>
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">{(doente.cama?.numero ?? '—')}</span>
                </div>
                <div>
                  <Link href={`/doentes/${doente.id}`} className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                    {doente.nome}
                  </Link>
                  <p className="text-xs text-slate-500">{t('roomBed', { quarto: doente.cama?.quarto ?? '—', cama: doente.cama?.numero ?? '—' })}</p>
                </div>
                <span className="ml-auto text-xs text-slate-500">{t('medCount', { n: meds.length })}</span>
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
                            <span className={`text-xs font-medium ${validacaoCor[validacao] ?? 'text-slate-500'}`}>
                              {validacao === 'aprovada' ? t('validated') : validacao === 'rejeitada' ? t('rejected') : t('notValidated')}
                            </span>
                          )}
                          {/* QA-15: por validar pela farmácia — a administração pode ser bloqueada ou pedir justificação. */}
                          {!validacao && <span className="text-xs font-medium text-amber-700">{t('notValidated')}</span>}
                          {ultimaAdmin?.verificacao5Certas && (
                            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 rounded-md badge-pad py-0.5">5✓</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3" style={{ marginTop: '4px' }}>
                          <span className="text-xs text-slate-500">{m.frequencia}</span>
                          {/* QA-08: num SOS, quando foi a última toma (o intervalo mínimo é verificado na API). */}
                          {/^sos/i.test(m.frequencia) && (() => {
                            const ultima = m.registos.find((r) => !r.naoAdministrada);
                            if (!ultima) return <span className="text-xs text-slate-500">{t('noDosesYet')}</span>;
                            const min = Math.round((Date.now() - new Date(ultima.administradoEm).getTime()) / 60000);
                            return (
                              <span className={`text-xs font-semibold ${min < 60 ? 'text-red-600' : 'text-slate-600'}`}>
                                {t('lastDoseAgo', { tempo: min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min` })}
                              </span>
                            );
                          })()}
                          {ultimaAdmin && (
                            <span className={`text-xs ${ultimaAdmin.naoAdministrada ? 'text-red-400' : 'text-slate-500'}`}>
                              {ultimaAdmin.naoAdministrada
                                ? t('notGivenBy', { motivo: ultimaAdmin.motivoNaoAdmin ?? '', nome: ultimaAdmin.administradoPor.nome })
                                : t('lastBy', { hora: new Date(ultimaAdmin.administradoEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }), nome: ultimaAdmin.administradoPor.nome })}
                              <RegistoDiferido ocorridoEm={ultimaAdmin.administradoEm} registadoEm={ultimaAdmin.registadoEm} />
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
                          {t('administer')}
                        </button>
                        <button
                          onClick={() => { setModalNaoAdmin(m.id); setMotivoSelecionado('recusou'); setMotivoOutro(''); }}
                          disabled={validacao === 'rejeitada'}
                          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ padding: '7px 14px' }}>
                          {t('notGiven')}
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
        <div role="presentation" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}
             onClick={(e) => e.target === e.currentTarget && setModalNaoAdmin(null)}>
          <div {...dlgNaoAdmin.propsPainel} className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '420px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
              <h2 className="text-base font-bold text-slate-900">{t('notGivenTitle')}</h2>
              <button aria-label={tc('close')} onClick={() => setModalNaoAdmin(null)} className="text-slate-500 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-xs text-slate-500" style={{ marginBottom: '20px' }}>
              {medicacoes.find(m => m.id === modalNaoAdmin)?.nome} · {medicacoes.find(m => m.id === modalNaoAdmin)?.doente.nome}
            </p>
            <div className="flex flex-col gap-2" style={{ marginBottom: '20px' }}>
              {MOTIVOS_NAO_ADMIN.map(valor => (
                <label key={valor}
                  className={`flex items-center gap-3 rounded-xl border cursor-pointer transition-colors ${motivoSelecionado === valor ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                  style={{ padding: '10px 14px' }}>
                  <input type="radio" name="motivo" value={valor} checked={motivoSelecionado === valor}
                    onChange={() => setMotivoSelecionado(valor)} className="accent-red-600" />
                  <span className="text-sm font-medium text-slate-700">{t(`reason.${valor}`)}</span>
                </label>
              ))}
              {motivoSelecionado === 'outro' && (
                <input value={motivoOutro} onChange={e => setMotivoOutro(e.target.value)}
                  placeholder={t('describeReason')}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                  style={{ padding: '10px 14px', marginTop: '4px' }} />
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setModalNaoAdmin(null)}
                style={{ padding: '11px' }}>{tc('cancel')}</Button>
              <Button variant="danger" className="flex-1" onClick={registarNaoAdmin}
                disabled={registandoNaoAdmin || (motivoSelecionado === 'outro' && !motivoOutro.trim())}
                style={{ padding: '11px' }}>
                {registandoNaoAdmin ? t('recording') : tc('confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5 Corretas */}
      {modalId && (
        <div role="presentation" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}
             onClick={(e) => e.target === e.currentTarget && setModalId(null)}>
          <div {...dlg5Certas.propsPainel} className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '480px', maxHeight: '90vh', padding: '32px', margin: '0 16px' }}>

            {/* Header */}
            <div className="flex items-center gap-3" style={{ marginBottom: '6px' }}>
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{t('fiveRightsTitle')}</h2>
                <p className="text-xs text-slate-500">{modalMed?.nome} · {modalMed?.doente.nome}</p>
              </div>
            </div>

            {/* Aviso */}
            <div className="rounded-xl text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100" style={{ padding: '10px 14px', marginBottom: '20px', marginTop: '12px' }}>
              {t('fiveRightsHint')}
            </div>

            {/* UX-02: alergias visíveis no acto de administrar */}
            {modalMed && (
              <div style={{ marginBottom: '16px' }}>
                <FaixaAlergiasDoente doenteId={modalMed.doente.id} compacta />
              </div>
            )}

            {/* UX-08: pulseira e embalagem lidas (verificadas no servidor) dão os certos 1 e 2. */}
            {modalMed && (
              <div style={{ marginBottom: '16px' }}>
                <LeituraBcma medicacaoId={modalMed.id} doenteId={modalMed.doente.id} estado={leitura} onChange={mudarLeitura} />
              </div>
            )}

            {/* Checklist */}
            <div className="flex flex-col gap-3" style={{ marginBottom: '20px' }}>
              {[0, 1, 2, 3, 4].map((i) => (
                // eslint-disable-next-line jsx-a11y/label-has-associated-control -- checkbox envolvido pela label (associação implícita)
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
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '2px' }}>{t(`right.${i}`)}</p>
                    <p className={`text-sm font-medium truncate ${certas[i] ? 'text-emerald-700' : 'text-slate-700'}`}>{certasValues[i]}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Observações */}
            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
              {t('notesOptional')}
            </span>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder={t('notesPlaceholder')}
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
              <Button variant="secondary" className="flex-1" onClick={() => setModalId(null)}
                style={{ padding: '11px' }}>{tc('cancel')}</Button>
              <button
                onClick={() => administrar()}
                disabled={!todasMarcadas || !!administrando || leituraBloqueia(leitura)}
                className="flex-1 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ padding: '11px' }}>
                {administrando ? t('recording') : todasMarcadas ? t('confirmAdministration') : t('itemsLeft', { n: 5 - certas.filter(Boolean).length })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
