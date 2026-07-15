'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalAuthProvider, usePortalAuth, portalFetch } from '../../portal-auth-context';

function DocumentosContent() {
  const { token, loading: authLoading } = usePortalAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    portalFetch('/portal/documentos', token).then(setDocs).catch(() => setDocs([])).finally(() => setLoading(false));
  }, [token]);

  if (authLoading) return null;

  if (!token) { if (typeof window !== 'undefined') window.location.href = '/portal/login'; return null; }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <Link href="/portal" style={{ textDecoration: 'none', color: '#64748b', fontSize: '13px' }}>← Voltar</Link>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>Os Meus Documentos</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '14px' }}>A carregar...</div>
      ) : docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '14px' }}>Sem documentos disponíveis</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {docs.map((doc: any) => (
            <div key={doc.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b', marginBottom: '2px' }}>{doc.titulo ?? doc.tipo}</p>
                <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {doc.dataDocumento ? new Date(doc.dataDocumento).toLocaleDateString('pt-PT') : '—'}
                  {doc.especialidade ? ` · ${doc.especialidade}` : ''}
                </p>
              </div>
              {doc.url && (
                <a href={doc.url} target="_blank" rel="noopener noreferrer"
                  style={{ background: '#eff6ff', color: '#3b82f6', fontSize: '12px', fontWeight: 600, borderRadius: '8px', padding: '6px 14px', textDecoration: 'none' }}>
                  Ver
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentosPage() {
  return <PortalAuthProvider><DocumentosContent /></PortalAuthProvider>;
}
