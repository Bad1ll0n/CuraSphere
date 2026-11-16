'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

/**
 * UX-29 — faixa de identificação, sempre visível (sticky) na ficha: quem é o doente e o que não
 * pode falhar, num relance. Nome completo, idade e processo, cama, alergias, peso, isolamento,
 * decisão de não reanimar, risco de queda, NEWS2 com hora e tendência e sinalizações activas.
 */
interface Faixa {
  id: string; nome: string; numeroProcesso: string; idade: number | null; sexo: string | null;
  cama: { numero: string; quarto: string; servico?: string | null } | null;
  pesoKg: number | null;
  alergias: { estado: string; lista: { alergenio: string; severidade: string }[] };
  isolamento: string | null;
  naoReanimar: { em: string | null } | null;
  riscoQueda: { risco: string; pontuacao: number } | null;
  news2: { valor: number | null; em: string; tendencia: 'sobe' | 'desce' | 'igual' | null } | null;
  sinalizacoes: { motivo: string; nivelUrgencia: string }[];
}

const hora = (d: string) => new Date(d).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

export function FaixaIdentificacao({ doenteId, podeRegistarDnr = false }: { doenteId: string; podeRegistarDnr?: boolean }) {
  const toast = useToast();
  const t = useTranslations('idBand');
  const [f, setF] = useState<Faixa | null>(null);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(() => {
    api.get(`/resumo/doente/${doenteId}/faixa`).then((r) => { setF(r.data); setErro(false); }).catch(() => setErro(true));
  }, [doenteId]);
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60_000);
    return () => clearInterval(t);
  }, [carregar]);

  const alternarDnr = async () => {
    if (!f) return;
    const ativo = !f.naoReanimar;
    const notas = ativo ? window.prompt(t('dnrPrompt')) : t('dnrRevokedNote');
    if (ativo && !notas?.trim()) return;
    try {
      await api.patch(`/resumo/doente/${doenteId}/nao-reanimar`, { ativo, notas: notas?.trim() });
      toast.success(ativo ? t('dnrRecorded') : t('dnrRevoked'));
      carregar();
    } catch (e: any) { toast.error(e?.response?.data?.message ?? t('recordError')); }
  };

  if (erro) {
    return (
      <div role="alert" className="rounded-xl bg-slate-100 text-slate-700 text-sm" style={{ padding: '8px 12px' }}>
        {t('loadError')}
      </div>
    );
  }
  if (!f) return <div className="rounded-xl bg-slate-100 animate-pulse" style={{ height: '52px' }} aria-busy="true" />;

  const news = f.news2?.valor;
  const alergiasTexto = f.alergias.estado === 'nao_avaliado'
    ? t('allergiesNotAssessed')
    : f.alergias.lista.length ? t('allergiesList', { lista: f.alergias.lista.map((a) => a.alergenio).join(', ') }) : t('noKnownAllergies');
  const corAlergias = f.alergias.estado === 'nao_avaliado' ? 'bg-amber-100 text-amber-900 border-amber-300'
    : f.alergias.lista.length ? 'bg-red-100 text-red-800 border-red-300' : 'bg-green-50 text-green-800 border-green-200';

  return (
    <section aria-label={t('label')}
      className="faixa-identificacao sticky z-20 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-wrap items-center gap-x-4 gap-y-2"
      style={{ top: '64px', padding: '10px 14px' }}>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{f.nome}</p>
        <p className="text-xs text-slate-600">
          {f.idade != null ? t('age', { idade: f.idade }) : t('ageUnknown')}{f.sexo ? ` · ${f.sexo === 'feminino' ? 'F' : f.sexo === 'masculino' ? 'M' : 'I'}` : ''} · {t('record', { n: f.numeroProcesso })}
          {f.cama ? ` · ${t('bed', { cama: `${f.cama.quarto}/${f.cama.numero}` })}` : ''}{f.pesoKg ? ` · ${f.pesoKg} kg` : ''}
        </p>
      </div>
      <span className={`text-xs font-bold border rounded-full ${corAlergias}`} style={{ padding: '3px 10px' }}>{alergiasTexto}</span>
      {f.naoReanimar && <span className="text-xs font-bold border rounded-full bg-red-600 text-white border-red-700" style={{ padding: '3px 10px' }}>{t('dnr')}</span>}
      {f.isolamento && <span className="text-xs font-semibold border rounded-full bg-amber-100 text-amber-900 border-amber-300" style={{ padding: '3px 10px' }}>{t('isolation', { motivo: f.isolamento })}</span>}
      {f.riscoQueda && f.riscoQueda.risco !== 'baixo' && (
        <span className="text-xs font-semibold border rounded-full bg-orange-100 text-orange-900 border-orange-300" style={{ padding: '3px 10px' }}>
          {t('fallRisk', { risco: f.riscoQueda.risco, pontuacao: f.riscoQueda.pontuacao })}
        </span>
      )}
      {f.news2 && news != null && (
        <span className={`text-xs font-bold border rounded-full ${news >= 7 ? 'bg-red-100 text-red-800 border-red-300' : news >= 5 ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-200'}`}
          style={{ padding: '3px 10px' }} title={t('recordedAt', { hora: hora(f.news2.em) })}>
          NEWS2 {news}{f.news2.tendencia === 'sobe' ? ' ↑' : f.news2.tendencia === 'desce' ? ' ↓' : ''} · {hora(f.news2.em)}
        </span>
      )}
      {f.sinalizacoes.map((s, i) => (
        <span key={i} className="text-xs font-semibold border rounded-full bg-amber-50 text-amber-900 border-amber-300" style={{ padding: '3px 10px' }}>
          ⚠ {s.motivo}
        </span>
      ))}
      {podeRegistarDnr && (
        <button onClick={alternarDnr} className="ml-auto text-xs font-semibold text-slate-600 hover:text-slate-900 underline">
          {f.naoReanimar ? t('revokeDnr') : t('recordDnr')}
        </button>
      )}
    </section>
  );
}
