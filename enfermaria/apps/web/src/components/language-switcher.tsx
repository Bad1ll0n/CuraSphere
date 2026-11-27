'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';

const LOCALES = [
  { code: 'pt', label: 'PT', flag: '🇵🇹' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'uk', label: 'UK', flag: '🇺🇦' },
] as const;
export type CodigoIdioma = (typeof LOCALES)[number]['code'];

const TITULO: Record<CodigoIdioma, string> = { pt: 'portuguese', en: 'englishBeta', es: 'spanish', uk: 'ukrainian' };

/** UX-26: a aplicação do pessoal tem PT/EN; o quiosque oferece também espanhol e ucraniano. */
export function LanguageSwitcher({ idiomas = ['pt', 'en'] }: { idiomas?: readonly CodigoIdioma[] }) {
  const locale = useLocale();
  const t = useTranslations('layout');
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
      aria-label={t('languageGroup')}
      role="group"
    >
      {LOCALES.filter(({ code }) => idiomas.includes(code)).map(({ code, label, flag }) => {
        const isActive = locale === code;
        return (
          <button
            key={code}
            onClick={() => !isActive && switchLocale(code)}
            disabled={isPending}
            aria-pressed={isActive}
            // UX-07: o inglês cobre os fluxos clínicos principais, não a aplicação toda — diz-se.
            title={t(TITULO[code])}
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
            {code === 'en' && (
              <span aria-hidden="true" style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#92400e', background: '#fef3c7', borderRadius: '4px', padding: '0 4px' }}>beta</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
