'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

type Tema = 'light' | 'dark' | 'high-contrast';

const PROXIMO: Record<Tema, Tema> = { light: 'dark', dark: 'high-contrast', 'high-contrast': 'light' };
const LABEL: Record<Tema, string> = { light: '🌙', dark: '◐', 'high-contrast': '☀️' };

export function DarkModeToggle() {
  const t = useTranslations('theme');
  const [tema, setTema] = useState<Tema>('light');

  useEffect(() => {
    const saved = localStorage.getItem('curasphere-theme') as Tema | null;
    if (saved === 'dark' || saved === 'high-contrast') setTema(saved);
    else setTema('light');
  }, []);

  const toggle = () => {
    const next = PROXIMO[tema];
    setTema(next);
    document.documentElement.classList.remove('dark', 'high-contrast');
    if (next === 'dark') document.documentElement.classList.add('dark');
    else if (next === 'high-contrast') document.documentElement.classList.add('high-contrast');
    try { localStorage.setItem('curasphere-theme', next); } catch { /* ignore */ }
  };

  const ariaKey = tema === 'light' ? 'activateDark' : tema === 'dark' ? 'activateHighContrast' : 'activateLight';

  return (
    <button
      onClick={toggle}
      aria-label={t(ariaKey)}
      title={t(ariaKey)}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors"
      style={{ fontSize: '16px' }}
    >
      {LABEL[tema]}
    </button>
  );
}
