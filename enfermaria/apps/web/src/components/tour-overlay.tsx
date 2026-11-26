'use client';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { visitaDoPapel } from '@/lib/onboarding';
import { Button } from '@/components/ui';

interface Props {
  role: string;
  onConcluir: () => void;
}

/** Retângulo visível do elemento, ou null se não estiver no ecrã (menu fechado, sem acesso). */
function retanguloDe(seletor: string): DOMRect | null {
  const el = document.querySelector(seletor) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : null;
}

/**
 * UX-27 — visita guiada ancorada: cada passo destaca o elemento real do ecrã (item do menu,
 * pesquisa, bloqueio do posto) e explica-o ao lado. Por papel; volta a abrir-se no menu "?".
 * Os passos cujo elemento não está visível saltam — o texto nunca aponta para o vazio.
 */
export function TourOverlay({ role, onConcluir }: Props) {
  const t = useTranslations('tour');
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Só os passos com o elemento à vista, avaliado ao abrir.
  const passos = useMemo(() => visitaDoPapel(role).filter((p) => typeof document === 'undefined' || retanguloDe(p.alvo)), [role]);
  const passo = passos[step];

  useLayoutEffect(() => {
    if (!passo) return;
    const el = document.querySelector(passo.alvo) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
    setRect(retanguloDe(passo.alvo));
  }, [passo]);

  useEffect(() => {
    const atualizar = () => passo && setRect(retanguloDe(passo.alvo));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onConcluir(); };
    window.addEventListener('resize', atualizar);
    document.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('resize', atualizar); document.removeEventListener('keydown', onKey); };
  }, [passo, onConcluir]);

  if (!passo) return null;
  const ultimo = step === passos.length - 1;

  // Balão à direita do elemento (menu lateral) ou por baixo (barra do topo); centrado se não houver.
  const largura = 320;
  const estiloBalao: React.CSSProperties = rect
    ? rect.right + largura + 24 < window.innerWidth
      ? { top: Math.max(16, rect.top - 8), left: rect.right + 16 }
      : { top: rect.bottom + 12, left: Math.max(16, Math.min(rect.left, window.innerWidth - largura - 16)) }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="visita-titulo" aria-describedby="visita-texto">
      {rect ? (
        <div aria-hidden="true" className="fixed rounded-xl pointer-events-none transition-all"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: '0 0 0 9999px rgba(15,23,42,0.6)', outline: '3px solid #60a5fa' }} />
      ) : (
        <div aria-hidden="true" className="fixed inset-0" style={{ background: 'rgba(15,23,42,0.6)' }} />
      )}
      <div className="fixed bg-white rounded-2xl shadow-2xl" style={{ width: largura, padding: '20px', ...estiloBalao }}>
        <p className="text-xs font-semibold text-blue-700" style={{ marginBottom: '6px' }}>{t('progress', { atual: step + 1, total: passos.length })}</p>
        <h2 id="visita-titulo" className="text-base font-bold text-slate-900" style={{ marginBottom: '6px' }}>{t(`passo.${passo.id}.titulo`)}</h2>
        <p id="visita-texto" className="text-sm text-slate-600 leading-relaxed">{t(`passo.${passo.id}.texto`)}</p>
        <div className="flex items-center gap-2" style={{ marginTop: '16px' }}>
          <button type="button" onClick={onConcluir} className="text-sm text-slate-500 hover:text-slate-700" style={{ marginRight: 'auto' }}>
            {t('buttons.skip')}
          </button>
          {step > 0 && (
            <Button variant="secondary" type="button" onClick={() => setStep((s) => s - 1)}  style={{ padding: '8px 14px' }}>
              {t('buttons.prev')}
            </Button>
          )}
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- o foco vai para a ação principal da visita */}
          <Button variant="primary" type="button" autoFocus onClick={() => (ultimo ? onConcluir() : setStep((s) => s + 1))}
             style={{ padding: '8px 16px' }}>
            {ultimo ? t('buttons.start') : t('buttons.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
