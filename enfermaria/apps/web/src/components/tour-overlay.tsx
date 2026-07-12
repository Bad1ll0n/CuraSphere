'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface Passo {
  titulo: string;
  descricao: string;
  emoji: string;
}

interface Props {
  role: string;
  onConcluir: () => void;
}

export function TourOverlay({ role, onConcluir }: Props) {
  const t = useTranslations('tour');
  const [step, setStep] = useState(0);

  const section = role === 'medico' ? 'medico'
    : ['enfermeiro', 'chefe_turno', 'chefe_enfermeiros'].includes(role) ? 'enfermeiro'
    : 'default';

  const count = section === 'medico' || section === 'enfermeiro' ? 5 : 3;
  const passos: Passo[] = Array.from({ length: count }, (_, i) => ({
    emoji: t(`${section}.step${i + 1}Title`).split(' ').find(w => /\p{Emoji}/u.test(w)) ?? '✅',
    titulo: t(`${section}.step${i + 1}Title`),
    descricao: t(`${section}.step${i + 1}Desc`),
  }));

  const passo = passos[step];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" style={{ backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl" style={{ maxWidth: '440px', width: '90%', padding: '36px 32px' }}>
        <div className="flex items-center gap-1.5" style={{ marginBottom: '28px' }}>
          {passos.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'bg-blue-600 w-6' : i < step ? 'bg-blue-300 w-3' : 'bg-slate-200 w-3'}`} />
          ))}
        </div>

        <div className="text-center" style={{ marginBottom: '32px' }}>
          <div className="text-5xl" style={{ marginBottom: '16px' }}>{passo.emoji}</div>
          <h2 className="text-xl font-bold text-slate-900" style={{ marginBottom: '10px' }}>{passo.titulo}</h2>
          <p className="text-slate-500 text-sm leading-relaxed">{passo.descricao}</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onConcluir}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            style={{ marginRight: 'auto' }}>
            {t('buttons.skip')}
          </button>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
              style={{ padding: '10px 20px' }}>
              {t('buttons.prev')}
            </button>
          )}
          {step < passos.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              style={{ padding: '10px 24px' }}>
              {t('buttons.next')}
            </button>
          ) : (
            <button onClick={onConcluir}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              style={{ padding: '10px 24px' }}>
              {t('buttons.start')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
