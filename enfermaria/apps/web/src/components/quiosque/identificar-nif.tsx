'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { quiosqueFetch } from '@/lib/quiosque-token';

export interface UtenteIdentificado {
  /** Identificação assinada (5 min) — vai no cabeçalho `x-quiosque-identificacao`. */
  identificacao: string;
  /** Nome abreviado ("Maria S."). */
  nome: string;
}

const campo: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 12, padding: '16px', color: '#fff', fontSize: 28, fontWeight: 800,
  textAlign: 'center', letterSpacing: 4, boxSizing: 'border-box', marginBottom: 16, fontFamily: 'monospace',
};

/**
 * SEC-12 — o utente identifica-se com o NIF E a data de nascimento (antes bastava o NIF, e o
 * quiosque mostrava o nome completo e a data de nascimento de quem o tivesse).
 */
export function IdentificarNif({ api, onIdentificado, onVoltar }: { api: string; onIdentificado: (u: UtenteIdentificado) => void; onVoltar: () => void }) {
  const t = useTranslations('kiosk');
  const [nif, setNif] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [erro, setErro] = useState('');
  const [aProcurar, setAProcurar] = useState(false);
  const pronto = nif.length === 9 && /^\d{4}-\d{2}-\d{2}$/.test(nascimento);

  const identificar = async () => {
    if (!pronto) return;
    setAProcurar(true);
    setErro('');
    try {
      const res = await quiosqueFetch(`${api}/quiosque/identificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nif, dataNascimento: nascimento }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setErro(res.status === 429 ? t('tooManyAttempts') : e.message ?? t('nifNotFound'));
        return;
      }
      onIdentificado(await res.json());
    } finally {
      setAProcurar(false);
    }
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid #3b82f660', borderRadius: 20, padding: '40px 48px', width: '100%', maxWidth: 480, textAlign: 'center' }}>
      <h2 style={{ color: '#fff', fontSize: 24, marginBottom: 8 }}>{t('identifyNif')}</h2>
      <p style={{ color: 'var(--text-dim)', fontSize: 15, marginBottom: 24 }}>{t('nifDobHint')}</p>
      <label htmlFor="quiosque-nif" style={{ display: 'block', color: 'var(--text-dim)', fontSize: 14, marginBottom: 6 }}>{t('nifLabel')}</label>
      <input id="quiosque-nif" type="tel" inputMode="numeric" autoComplete="off" value={nif} maxLength={9} placeholder="000000000"
        onChange={(e) => { setNif(e.target.value.replace(/\D/g, '')); setErro(''); }} style={campo} />
      <label htmlFor="quiosque-nascimento" style={{ display: 'block', color: 'var(--text-dim)', fontSize: 14, marginBottom: 6 }}>{t('dobLabel')}</label>
      <input id="quiosque-nascimento" type="date" autoComplete="off" value={nascimento}
        onChange={(e) => { setNascimento(e.target.value); setErro(''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') identificar(); }} style={{ ...campo, fontSize: 22, letterSpacing: 1 }} />
      {erro && <p role="alert" style={{ color: '#fca5a5', fontSize: 14, marginBottom: 16 }}>{erro}</p>}
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" onClick={onVoltar}
          style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer' }}>
          {t('back')}
        </button>
        <button type="button" onClick={identificar} disabled={aProcurar || !pronto}
          style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: aProcurar || !pronto ? 0.6 : 1 }}>
          {aProcurar ? t('searching') : t('identify')}
        </button>
      </div>
    </div>
  );
}
