'use client';

import { useTranslations } from 'next-intl';
import { PROXIMO_TEMA, useTema, type Tema } from '@/lib/tema';

const LABEL: Record<Tema, string> = { light: '🌙', dark: '◐', 'high-contrast': '☀️' };

export function DarkModeToggle() {
  const t = useTranslations('theme');
  const [tema, definirTema] = useTema();

  const ariaKey = tema === 'light' ? 'activateDark' : tema === 'dark' ? 'activateHighContrast' : 'activateLight';

  return (
    <button
      onClick={() => definirTema(PROXIMO_TEMA[tema])}
      aria-label={t(ariaKey)}
      title={t(ariaKey)}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors"
      style={{ fontSize: '16px' }}
    >
      <span aria-hidden="true">{LABEL[tema]}</span>
    </button>
  );
}
