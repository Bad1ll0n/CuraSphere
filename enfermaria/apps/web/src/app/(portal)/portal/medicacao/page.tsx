'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { PortalAuthProvider, usePortalAuth, portalFetch } from '../../portal-auth-context';

function MedicacaoContent() {
  const t = useTranslations('patientPortal');
  const { autenticado, loading: authLoading } = usePortalAuth();
  const [medicacao, setMedicacao] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!autenticado) return;
    portalFetch('/portal/medicacao').then(setMedicacao).catch(() => setMedicacao([])).finally(() => setLoading(false));
  }, [autenticado]);

  if (authLoading) return null;

  if (!autenticado) { if (typeof window !== 'undefined') window.location.href = '/portal/login'; return null; }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <Link href="/portal" style={{ textDecoration: 'none', color: 'var(--text-soft)', fontSize: '13px' }}>← Voltar</Link>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>Medicação Ativa</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)', fontSize: '14px' }}>A carregar...</div>
      ) : medicacao.length === 0 ? (
        // UX-28: o estado vazio explica porquê e o que fazer.
        <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: '14px' }}>
          <p style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '14px' }}>{t('noMedicationTitle')}</p>
          <p style={{ color: 'var(--text-soft)', fontSize: '13px', marginTop: '6px' }}>{t('noMedicationBody')}</p>
          <Link href="/portal/mensagem" style={{ display: 'inline-block', marginTop: '12px', color: 'var(--accent)', fontSize: '13px', fontWeight: 600 }}>{t('contactTeam')}</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {medicacao.map((m: any) => (
            <div key={m.id} style={{ background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)', marginBottom: '4px' }}>
                    {m.medicamento?.nome ?? m.nome ?? 'Medicamento'}
                  </p>
                  {m.dose && <p style={{ fontSize: '13px', color: 'var(--text-soft)', marginBottom: '2px' }}>Dose: {m.dose}</p>}
                  {m.posologia && <p style={{ fontSize: '13px', color: 'var(--text-soft)' }}>Posologia: {m.posologia}</p>}
                </div>
                <span style={{ background: '#f0fdf4', color: 'var(--success)', fontSize: '11px', fontWeight: 600, borderRadius: '6px', padding: '3px 8px', whiteSpace: 'nowrap' }}>
                  Ativa
                </span>
              </div>
              {m.via && (
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '6px' }}>Via: {m.via}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MedicacaoPage() {
  return <PortalAuthProvider><MedicacaoContent /></PortalAuthProvider>;
}
