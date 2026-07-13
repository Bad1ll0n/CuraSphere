'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PortalAuthProvider, usePortalAuth } from '../portal-auth-context';

const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api').replace(/\/$/, '');

function ExportarPage() {
  const { token } = usePortalAuth();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [erro, setErro] = useState('');

  if (!token) {
    if (typeof window !== 'undefined') window.location.href = '/portal/login';
    return null;
  }

  const downloadPdf = async () => {
    setErro('');
    setDownloadingPdf(true);
    try {
      const r = await fetch(`${API}/portal/exportar/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('Erro ao gerar PDF');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meus-dados-clinicos.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao descarregar PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const downloadJson = async () => {
    setErro('');
    setDownloadingJson(true);
    try {
      const r = await fetch(`${API}/portal/exportar/json`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('Erro ao exportar dados');
      const data = await r.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meus-dados-clinicos.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao descarregar JSON');
    } finally {
      setDownloadingJson(false);
    }
  };

  return (
    <div>
      <Link href="/portal" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', textDecoration: 'none', marginBottom: '24px' }}>
        ← Voltar ao portal
      </Link>

      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
        Os Meus Dados Clínicos
      </h1>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', lineHeight: '1.6' }}>
        Ao abrigo do <strong>Art. 20 do RGPD</strong> (Regulamento Geral sobre a Protecção de Dados), tem direito a receber os seus dados de saúde em formato legível e a transmiti-los a outra instituição.
      </p>

      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>⬇ Exportar como PDF</p>
        <p style={{ fontSize: '12px', color: '#4b5563', marginBottom: '16px' }}>
          Relatório clínico completo: dados pessoais, alergias, medicação activa, sinais vitais e notas de enfermagem.
        </p>
        <button
          onClick={downloadPdf}
          disabled={downloadingPdf}
          style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: downloadingPdf ? 'not-allowed' : 'pointer', opacity: downloadingPdf ? 0.7 : 1 }}>
          {downloadingPdf ? 'A gerar PDF...' : 'Descarregar PDF'}
        </button>
      </div>

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#1d4ed8', marginBottom: '4px' }}>⬇ Exportar como JSON</p>
        <p style={{ fontSize: '12px', color: '#4b5563', marginBottom: '16px' }}>
          Dados estruturados em formato legível por máquina: ideal para partilhar com outro sistema de saúde ou profissional.
        </p>
        <button
          onClick={downloadJson}
          disabled={downloadingJson}
          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: downloadingJson ? 'not-allowed' : 'pointer', opacity: downloadingJson ? 0.7 : 1 }}>
          {downloadingJson ? 'A exportar...' : 'Descarregar JSON'}
        </button>
      </div>

      {erro && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', color: '#dc2626' }}>{erro}</p>
        </div>
      )}

      <div style={{ background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
        <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.6' }}>
          Para exercer o seu <strong>direito ao apagamento</strong> (Art. 17 RGPD) ou para questões relacionadas com a privacidade dos seus dados, contacte o <strong>Encarregado de Protecção de Dados (DPO)</strong> da instituição hospitalar.
        </p>
      </div>
    </div>
  );
}

export default function ExportarPageWrapper() {
  return (
    <PortalAuthProvider>
      <ExportarPage />
    </PortalAuthProvider>
  );
}
