'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { PortalAuthProvider, usePortalAuth, portalFetch } from '../portal-auth-context';

/** UX-28: a próxima consulta agendada, ou nada (o cartão só aparece quando há uma). */
function ProximaConsulta() {
  const t = useTranslations('patientPortal');
  const locale = useLocale();
  const [c, setC] = useState<{ dataHora: string; especialidade: string; tipo: string; medico?: { nome: string } } | null>(null);
  useEffect(() => { portalFetch('/portal/proxima-consulta').then(setC).catch(() => setC(null)); }, []);
  if (!c) return null;
  const quando = new Date(c.dataHora);
  const fmt = locale === 'en' ? 'en-GB' : 'pt-PT';
  return (
    <section aria-labelledby="proxima-consulta" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '18px 20px', marginBottom: '20px' }}>
      <p id="proxima-consulta" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>{t('nextAppointment')}</p>
      <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
        {quando.toLocaleDateString(fmt, { weekday: 'long', day: 'numeric', month: 'long' })} · {quando.toLocaleTimeString(fmt, { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p style={{ fontSize: '14px', color: 'var(--text-soft)', marginTop: '4px' }}>
        {c.especialidade}{c.medico?.nome ? ` · ${c.medico.nome}` : ''} · {c.tipo === 'teleconsulta' ? t('videoCall') : t('inPerson')}
      </p>
    </section>
  );
}

function Dashboard() {
  const t = useTranslations('patientPortal');
  const { autenticado, loading, logout } = usePortalAuth();
  const [doente, setDoente] = useState<any>(null);

  useEffect(() => {
    if (!autenticado) return;
    portalFetch('/portal/me').then(setDoente).catch(() => null);
  }, [autenticado]);

  if (loading) return null;

  if (!autenticado) {
    if (typeof window !== 'undefined') window.location.href = '/portal/login';
    return null;
  }

  // UX-28: textos dos cartões traduzidos (o portal tem PT e EN).
  const cards = [
    { href: '/portal/documentos', chave: 'documents', icon: '📄', color: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    { href: '/portal/medicacao', chave: 'medication', icon: '💊', color: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
    { href: '/portal/plano-alta', chave: 'dischargePlan', icon: '🏠', color: '#fff7ed', border: '#fed7aa', text: '#9a3412' },
    { href: '/portal/pro', chave: 'howIFeel', icon: '❤', color: '#fff1f2', border: '#fecdd3', text: '#be123c' },
    { href: '/portal/mensagem', chave: 'contact', icon: '✉️', color: '#faf5ff', border: '#e9d5ff', text: '#7c3aed' },
    { href: '/portal/consentimentos', chave: 'consents', icon: '✔', color: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
    { href: '/portal/exportar', chave: 'myData', icon: '⬇', color: '#f8fafc', border: '#e2e8f0', text: '#475569' },
  ] as const;

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
          {/* UX-28: saudação neutra (antes "Bem-vindo" fixo no masculino). */}
          {doente?.nome ? t('helloName', { nome: doente.nome.split(' ')[0] }) : t('hello')}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-soft)' }}>
          {doente?.diagnosticoPrincipal ? t('diagnosis', { diagnostico: doente.diagnosticoPrincipal }) : t('welcome')}
        </p>
      </div>

      <ProximaConsulta />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
        {cards.map(card => (
          <Link key={card.href} href={card.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: card.color, border: `1px solid ${card.border}`, borderRadius: '16px', padding: '20px', cursor: 'pointer', transition: 'transform 0.1s' }}>
              <div style={{ fontSize: '28px', marginBottom: '10px' }}>{card.icon}</div>
              <p style={{ fontWeight: 700, fontSize: '14px', color: card.text, marginBottom: '4px' }}>{t(`card.${card.chave}.title`)}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-soft)' }}>{t(`card.${card.chave}.desc`)}</p>
            </div>
          </Link>
        ))}
      </div>

      <button
        onClick={logout}
        style={{ width: '100%', background: 'transparent', border: '1px solid #e2e8f0', color: 'var(--text-soft)', borderRadius: '12px', padding: '11px', fontSize: '13px', cursor: 'pointer' }}>
        {t('logout')}
      </button>
    </div>
  );
}

export default function PortalPage() {
  return (
    <PortalAuthProvider>
      <Dashboard />
    </PortalAuthProvider>
  );
}
