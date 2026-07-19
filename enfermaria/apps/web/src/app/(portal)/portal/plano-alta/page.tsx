'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalAuthProvider, usePortalAuth, portalFetch } from '../../portal-auth-context';

function PlanoAltaContent() {
  const { token, loading: authLoading } = usePortalAuth();
  const [plano, setPlano] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    portalFetch('/portal/plano-alta', token).then(setPlano).catch(() => setPlano(null)).finally(() => setLoading(false));
  }, [token]);

  if (authLoading) return null;

  if (!token) { if (typeof window !== 'undefined') window.location.href = '/portal/login'; return null; }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <Link href="/portal" style={{ textDecoration: 'none', color: 'var(--text-soft)', fontSize: '13px' }}>← Voltar</Link>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>Plano de Alta</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)', fontSize: '14px' }}>A carregar...</div>
      ) : !plano ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)', fontSize: '14px' }}>Plano de alta ainda não definido</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {plano.dataAltaPrevista && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', padding: '20px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Data Estimada de Alta
              </p>
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
                {new Date(plano.dataAltaPrevista).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
          {plano.resumo && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Resumo</p>
              <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{plano.resumo}</p>
            </div>
          )}
          {plano.criteriosAlta && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Critérios de Alta</p>
              <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{plano.criteriosAlta}</p>
            </div>
          )}
          {plano.instrucoes && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Instruções Pós-Alta</p>
              <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{plano.instrucoes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlanoAltaPage() {
  return <PortalAuthProvider><PlanoAltaContent /></PortalAuthProvider>;
}
