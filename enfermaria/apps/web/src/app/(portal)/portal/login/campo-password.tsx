'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

/** UX-28: password com "mostrar / ocultar" — no telemóvel, escrever às cegas bloqueava muita gente. */
export function CampoPassword({ valor, onChange, rotulo, autoComplete, id }: {
  valor: string; onChange: (v: string) => void; rotulo: string; autoComplete: 'current-password' | 'new-password'; id: string;
}) {
  const t = useTranslations('patientPortal');
  const [visivel, setVisivel] = useState(false);
  return (
    <div style={{ marginBottom: '16px' }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
        {rotulo}
      </label>
      <div style={{ position: 'relative' }}>
        <input id={id} type={visivel ? 'text' : 'password'} value={valor} onChange={(e) => onChange(e.target.value)} required autoComplete={autoComplete}
          style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '11px 84px 11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
        <button type="button" onClick={() => setVisivel((v) => !v)} aria-pressed={visivel} aria-controls={id}
          style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 0, color: 'var(--accent)', fontSize: '13px', fontWeight: 600, padding: '8px 10px', cursor: 'pointer' }}>
          {visivel ? t('hidePassword') : t('showPassword')}
        </button>
      </div>
    </div>
  );
}
