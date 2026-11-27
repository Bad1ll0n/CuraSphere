'use client';
import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { NOVIDADES } from '@/lib/novidades';

/** UX-27 — "O que há de novo", aberto a partir do menu "?". */
export function NovidadesModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('onboarding');
  const lingua = useLocale() === 'en' ? 'en' : 'pt';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="novidades-titulo" className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '520px', maxHeight: '80vh', margin: '0 16px', padding: '24px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
          <h2 id="novidades-titulo" className="text-lg font-bold text-slate-900">{t('whatsNew')}</h2>
          <button type="button" onClick={onClose} aria-label={t('close')} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        {NOVIDADES.map((n) => (
          <section key={n.id} style={{ marginTop: '14px' }}>
            <p className="text-xs font-semibold text-slate-500">{new Date(`${n.data}T12:00:00`).toLocaleDateString(lingua === 'en' ? 'en-GB' : 'pt-PT')}</p>
            <h3 className="text-sm font-bold text-slate-800" style={{ marginTop: '2px' }}>{n[lingua].titulo}</h3>
            <ul className="text-sm text-slate-600" style={{ marginTop: '6px', paddingLeft: '18px', listStyle: 'disc' }}>
              {n[lingua].itens.map((i) => <li key={i} style={{ marginTop: '4px' }}>{i}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
