'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { portalFetch } from '../../../portal-auth-context';
import { CampoPassword } from '../campo-password';

/** UX-28: nova password a partir da ligação enviada por email (30 min, uso único). */
export default function RedefinirPage() {
  const t = useTranslations('patientPortal');
  const [token, setToken] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    const tk = new URLSearchParams(window.location.search).get('token');
    if (!tk) return;
    setToken(tk);
    // O token não fica no histórico nem é enviado como Referer a outros sites.
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha !== confirmacao) { setErro(t('passwordsDiffer')); return; }
    setErro(''); setAEnviar(true);
    try {
      await portalFetch('/portal/redefinir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, senha }) });
      setFeito(true);
    } catch (err: any) {
      setErro(err?.message ?? t('genericError'));
    } finally { setAEnviar(false); }
  };

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', textAlign: 'center' }}>{t('resetTitle')}</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-soft)', textAlign: 'center', marginBottom: '24px' }}>{t('passwordRules')}</p>
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '32px', border: '1px solid #e2e8f0' }}>
        {feito ? (
          <p role="status" style={{ fontSize: '14px', color: 'var(--success)' }}>{t('resetDone')}</p>
        ) : !token ? (
          <p role="alert" style={{ fontSize: '14px', color: 'var(--danger)' }}>{t('invalidLink')}</p>
        ) : (
          <form onSubmit={submeter}>
            <CampoPassword id="nova-senha" rotulo={t('newPassword')} valor={senha} onChange={setSenha} autoComplete="new-password" />
            <CampoPassword id="confirmar-senha" rotulo={t('confirmPassword')} valor={confirmacao} onChange={setConfirmacao} autoComplete="new-password" />
            {erro && <p role="alert" style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{erro}</p>}
            <button type="submit" disabled={aEnviar}
              style={{ width: '100%', background: 'var(--accent)', color: 'var(--bg-card)', fontWeight: 600, borderRadius: '12px', padding: '12px', fontSize: '14px', border: 'none', opacity: aEnviar ? 0.7 : 1 }}>
              {t('savePassword')}
            </button>
          </form>
        )}
      </div>
      <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
        <Link href={feito ? '/portal/login' : '/portal/login/recuperar'} style={{ color: 'var(--accent)' }}>{feito ? t('backToLogin') : t('requestNewLink')}</Link>
      </p>
    </div>
  );
}
