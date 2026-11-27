'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { portalFetch } from '../../../portal-auth-context';

/** UX-28: "Esqueci-me da password" — pede a ligação por email (a resposta é sempre a mesma). */
export default function RecuperarPage() {
  const t = useTranslations('patientPortal');
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(''); setAEnviar(true);
    try {
      const r = await portalFetch('/portal/recuperar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      setEnviado(r?.mensagem ?? t('resetSent'));
    } catch (err: any) {
      setErro(err?.message ?? t('genericError'));
    } finally { setAEnviar(false); }
  };

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', textAlign: 'center' }}>{t('forgotTitle')}</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-soft)', textAlign: 'center', marginBottom: '24px' }}>{t('forgotBody')}</p>
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '32px', border: '1px solid #e2e8f0' }}>
        {enviado ? (
          <p role="status" style={{ fontSize: '14px', color: 'var(--success)' }}>{enviado}</p>
        ) : (
          <form onSubmit={submeter}>
            <label htmlFor="rec-email" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              {t('email')}
            </label>
            <input id="rec-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }} />
            {erro && <p role="alert" style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{erro}</p>}
            <button type="submit" disabled={aEnviar}
              style={{ width: '100%', background: 'var(--accent)', color: 'var(--bg-card)', fontWeight: 600, borderRadius: '12px', padding: '12px', fontSize: '14px', border: 'none', opacity: aEnviar ? 0.7 : 1 }}>
              {t('sendLink')}
            </button>
          </form>
        )}
      </div>
      <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
        <Link href="/portal/login" style={{ color: 'var(--accent)' }}>{t('backToLogin')}</Link>
      </p>
      <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px' }}>{t('noEmailHelp')}</p>
    </div>
  );
}
