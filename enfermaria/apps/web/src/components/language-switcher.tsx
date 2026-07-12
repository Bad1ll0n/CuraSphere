'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';

const LOCALES = [
  { code: 'pt', label: 'PT', flag: '🇵🇹' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (next: string) => {
    startTransition(() => {
      document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      window.location.reload();
    });
  };

  return (
    <div
      className="flex items-center rounded-xl border border-slate-200 overflow-hidden"
      style={{ background: 'var(--bg-card, white)' }}
      aria-label="Selecionar idioma"
      role="group"
    >
      {LOCALES.map(({ code, label, flag }) => {
        const isActive = locale === code;
        return (
          <button
            key={code}
            onClick={() => !isActive && switchLocale(code)}
            disabled={isPending}
            aria-pressed={isActive}
            title={code === 'pt' ? 'Português' : 'English'}
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#2563eb' : '#64748b',
              background: isActive ? '#eff6ff' : 'transparent',
              border: 'none',
              cursor: isActive ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'background 0.15s',
            }}
          >
            <span>{flag}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
