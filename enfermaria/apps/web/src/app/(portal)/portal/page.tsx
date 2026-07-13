'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalAuthProvider, usePortalAuth, portalFetch } from './portal-auth-context';

function Dashboard() {
  const { token, logout } = usePortalAuth();
  const [doente, setDoente] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    portalFetch('/portal/me', token).then(setDoente).catch(() => null);
  }, [token]);

  if (!token) {
    if (typeof window !== 'undefined') window.location.href = '/portal/login';
    return null;
  }

  const cards = [
    { href: '/portal/documentos', label: 'Os Meus Documentos', desc: 'Relatórios e exames clínicos', icon: '📄', color: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    { href: '/portal/medicacao', label: 'Medicação Activa', desc: 'Os seus medicamentos prescritos', icon: '💊', color: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
    { href: '/portal/plano-alta', label: 'Plano de Alta', desc: 'Critérios e data estimada de alta', icon: '🏠', color: '#fff7ed', border: '#fed7aa', text: '#9a3412' },
    { href: '/portal/pro', label: 'Como me Sinto', desc: 'Registe sintomas e bem-estar', icon: '❤', color: '#fff1f2', border: '#fecdd3', text: '#be123c' },
    { href: '/portal/mensagem', label: 'Contactar Equipa', desc: 'Enviar uma mensagem à equipa', icon: '✉️', color: '#faf5ff', border: '#e9d5ff', text: '#7c3aed' },
    { href: '/portal/exportar', label: 'Os Meus Dados', desc: 'Exportar dados clínicos (RGPD)', icon: '⬇', color: '#f8fafc', border: '#e2e8f0', text: '#475569' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
          Olá{doente?.nome ? `, ${doente.nome.split(' ')[0]}` : ''}
        </h1>
        <p style={{ fontSize: '13px', color: '#64748b' }}>
          {doente?.diagnosticoPrincipal ? `Diagnóstico: ${doente.diagnosticoPrincipal}` : 'Bem-vindo ao seu portal de saúde'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
        {cards.map(card => (
          <Link key={card.href} href={card.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: card.color, border: `1px solid ${card.border}`, borderRadius: '16px', padding: '20px', cursor: 'pointer', transition: 'transform 0.1s' }}>
              <div style={{ fontSize: '28px', marginBottom: '10px' }}>{card.icon}</div>
              <p style={{ fontWeight: 700, fontSize: '13px', color: card.text, marginBottom: '4px' }}>{card.label}</p>
              <p style={{ fontSize: '11px', color: '#64748b' }}>{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <button
        onClick={logout}
        style={{ width: '100%', background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: '12px', padding: '11px', fontSize: '13px', cursor: 'pointer' }}>
        Terminar Sessão
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
