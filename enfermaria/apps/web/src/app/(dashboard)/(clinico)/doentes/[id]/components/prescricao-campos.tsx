'use client';
import { useTranslations } from 'next-intl';
import { UNIDADES_DOSE } from '@org/shared';

const ROTULO = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide';
const CAMPO = 'w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500';

/** UX-17: dose em valor + unidade de lista fechada (a mesma que a API e o CHECK da BD aceitam). */
export function CampoDoseEstruturada({ valor, onValor, unidade, onUnidade }: {
  valor: string; onValor: (v: string) => void; unidade: string; onUnidade: (u: string) => void;
}) {
  const t = useTranslations('prescricao');
  return (
    <>
      <label htmlFor="fmedicaca-1" className={ROTULO} style={{ marginBottom: '8px' }}>{t('dose')} *</label>
      <div className="flex gap-2">
        <input id="fmedicaca-1" type="text" inputMode="decimal" value={valor} onChange={(e) => onValor(e.target.value.replace(/[^0-9.,]/g, ''))}
          placeholder="500" aria-describedby="fmedicaca-1-ajuda" className={CAMPO} style={{ padding: '10px 14px' }} />
        <select aria-label={t('unit')} value={unidade} onChange={(e) => onUnidade(e.target.value)}
          className="border border-slate-200 rounded-xl text-sm text-slate-800 bg-white" style={{ padding: '10px 8px' }}>
          {UNIDADES_DOSE.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <p id="fmedicaca-1-ajuda" className="text-xs text-slate-500" style={{ marginTop: '4px' }}>{t('doseHint')}</p>
    </>
  );
}

/** UX-17: para que é e por quanto tempo (sem duração = até nova ordem). */
export function CamposIndicacaoDuracao({ indicacao, onIndicacao, duracao, onDuracao }: {
  indicacao: string; onIndicacao: (v: string) => void; duracao: string; onDuracao: (v: string) => void;
}) {
  const t = useTranslations('prescricao');
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label htmlFor="fmed-indicacao" className={ROTULO} style={{ marginBottom: '8px' }}>{t('indication')}</label>
        <input id="fmed-indicacao" type="text" maxLength={300} value={indicacao} onChange={(e) => onIndicacao(e.target.value)}
          placeholder={t('indicationPlaceholder')} className={CAMPO} style={{ padding: '10px 14px' }} />
      </div>
      <div>
        <label htmlFor="fmed-duracao" className={ROTULO} style={{ marginBottom: '8px' }}>{t('duration')}</label>
        <input id="fmed-duracao" type="number" min={1} max={365} value={duracao} onChange={(e) => onDuracao(e.target.value)}
          placeholder={t('durationPlaceholder')} className={CAMPO} style={{ padding: '10px 14px' }} />
      </div>
    </div>
  );
}

/** UX-17: na lista ativa, para que é e até quando. */
export function IndicacaoEFim({ indicacao, dataFimPrevista }: { indicacao?: string | null; dataFimPrevista?: string | null }) {
  const t = useTranslations('prescricao');
  if (!indicacao && !dataFimPrevista) return null;
  const partes = [
    indicacao ? t('forIndication', { indicacao }) : null,
    dataFimPrevista ? t('until', { data: new Date(dataFimPrevista).toLocaleDateString('pt-PT') }) : null,
  ].filter(Boolean);
  return <p className="text-xs text-slate-500" style={{ marginTop: '2px' }}>{partes.join(' · ')}</p>;
}
