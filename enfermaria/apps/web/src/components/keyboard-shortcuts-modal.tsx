'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ open, onClose }: Props) {
  const t = useTranslations('shortcuts');
  const tCommon = useTranslations('common');

  const SHORTCUTS = [
    { key: 'Cmd / Ctrl + K', desc: t('openPalette') },
    { key: '? + texto', desc: t('aiSearch') },
    { key: '?', desc: t('showShortcuts') },
    { key: 'Escape', desc: t('closeModal') },
  ];

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-[400px] shadow-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-base text-slate-800 dark:text-slate-100">{t('title')}</h2>
          <button
            onClick={onClose}
            aria-label={tCommon('close')}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4">
              <kbd className="shrink-0 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 rounded text-xs font-mono border border-slate-200 dark:border-slate-600">
                {s.key}
              </kbd>
              <span className="text-sm text-slate-600 dark:text-slate-300 text-right">{s.desc}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-400 text-center">{t('hint')}</p>
      </div>
    </div>
  );
}
