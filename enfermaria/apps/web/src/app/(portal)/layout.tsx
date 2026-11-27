'use client';
import { useEffect, useState } from 'react';
import { Inter } from 'next/font/google';
import { useLocale, useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';
import '../global.css';

const CHAVE_LETRA = 'portal:letra-grande';

const inter = Inter({ subsets: ['latin'] });

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('patientPortal');
  const locale = useLocale();
  // UX-28: letra grande, lembrada neste dispositivo (não é dado clínico).
  const [grande, setGrande] = useState(false);
  useEffect(() => { try { setGrande(localStorage.getItem(CHAVE_LETRA) === '1'); } catch { /* sem armazenamento: fica normal */ } }, []);
  const alternarLetra = () => {
    setGrande((g) => { try { localStorage.setItem(CHAVE_LETRA, g ? '0' : '1'); } catch { /* idem */ } return !g; });
  };
  // NOTA: este é um layout ANINHADO dentro do root layout (app/layout.tsx), que já emite
  // <html>/<body>. Um layout aninhado NUNCA deve emitir os seus próprios <html>/<body> —
  // isso produz HTML inválido (tags aninhadas) e hydration mismatch. Envolvemos em <div>.
  return (
    <div lang={locale} className={inter.className} style={{ background: '#f0f4f8', minHeight: '100vh', zoom: grande ? 1.2 : 1 }}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: 'var(--bg-card)', borderBottom: '1px solid #e2e8f0', padding: '16px 0' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#3b82f6" />
              <path d="M20 10v20M10 20h20" stroke="white" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-main)' }}>CuraSphere</span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: '4px' }}>{t('title')}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button type="button" onClick={alternarLetra} aria-pressed={grande} aria-label={t('largeText')} title={t('largeText')}
                style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '4px 10px', fontWeight: 700, fontSize: '14px', background: grande ? 'var(--bg-surface-2)' : 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}>
                A+
              </button>
              <LanguageSwitcher />
            </div>
          </div>
        </header>
        <main style={{ flex: 1, maxWidth: '480px', margin: '0 auto', width: '100%', padding: '40px 24px' }}>
          {children}
        </main>
        <footer style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--text-dim)' }}>
          © {new Date().getFullYear()} CuraSphere — {t('title')}
        </footer>
      </div>
    </div>
  );
}
