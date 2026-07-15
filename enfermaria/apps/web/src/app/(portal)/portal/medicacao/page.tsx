'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalAuthProvider, usePortalAuth, portalFetch } from '../../portal-auth-context';

function MedicacaoContent() {
  const { token, loading: authLoading } = usePortalAuth();
  const [medicacao, setMedicacao] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    portalFetch('/portal/medicacao', token).then(setMedicacao).catch(() => setMedicacao([])).finally(() => setLoading(false));
  }, [token]);

  if (authLoading) return null;

  if (!token) { if (typeof window !== 'undefined') window.location.href = '/portal/login'; return null; }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <Link href="/portal" style={{ textDecoration: 'none', color: '#64748b', fontSize: '13px' }}>← Voltar</Link>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>Medicação Activa</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '14px' }}>A carregar...</div>
      ) : medicacao.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '14px' }}>Sem medicação activa registada</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {medicacao.map((m: any) => (
            <div key={m.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b', marginBottom: '4px' }}>
                    {m.medicamento?.nome ?? m.nome ?? 'Medicamento'}
                  </p>
                  {m.dose && <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '2px' }}>Dose: {m.dose}</p>}
                  {m.posologia && <p style={{ fontSize: '13px', color: '#64748b' }}>Posologia: {m.posologia}</p>}
                </div>
                <span style={{ background: '#f0fdf4', color: '#166534', fontSize: '11px', fontWeight: 600, borderRadius: '6px', padding: '3px 8px', whiteSpace: 'nowrap' }}>
                  Activa
                </span>
              </div>
              {m.via && (
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>Via: {m.via}</p>
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
