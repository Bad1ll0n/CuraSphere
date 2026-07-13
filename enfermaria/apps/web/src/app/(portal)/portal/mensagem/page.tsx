'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PortalAuthProvider, usePortalAuth, portalFetch } from '../../portal-auth-context';

function MensagemContent() {
  const { token } = usePortalAuth();
  const [conteudo, setConteudo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  if (!token) { if (typeof window !== 'undefined') window.location.href = '/portal/login'; return null; }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conteudo.trim()) return;
    setErro('');
    setEnviando(true);
    try {
      await portalFetch('/portal/mensagem', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudo }),
      });
      setEnviado(true);
      setConteudo('');
    } catch (err: any) {
      setErro(err?.message ?? 'Erro ao enviar mensagem');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <Link href="/portal" style={{ textDecoration: 'none', color: '#64748b', fontSize: '13px' }}>← Voltar</Link>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>Contactar Equipa</h1>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
        {enviado ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <p style={{ fontWeight: 600, fontSize: '15px', color: '#1e293b', marginBottom: '6px' }}>Mensagem enviada</p>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>A equipa clínica irá ler a sua mensagem em breve.</p>
            <button
              onClick={() => setEnviado(false)}
              style={{ background: '#eff6ff', color: '#3b82f6', fontWeight: 600, borderRadius: '10px', padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
              Enviar Outra Mensagem
            </button>
          </div>
        ) : (
          <form onSubmit={enviar}>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Escreva a sua mensagem para a equipa clínica. Esta será entregue ao enfermeiro responsável.
            </p>
            <textarea
              value={conteudo}
              onChange={e => setConteudo(e.target.value)}
              rows={6}
              maxLength={1000}
              placeholder="A sua mensagem..."
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', fontSize: '14px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: '#1e293b' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>{conteudo.length}/1000</p>
            </div>
            {erro && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', color: '#dc2626', fontSize: '13px', marginTop: '12px' }}>
                {erro}
              </div>
            )}
            <button
              type="submit"
              disabled={enviando || !conteudo.trim()}
              style={{ width: '100%', background: '#7c3aed', color: '#fff', fontWeight: 600, borderRadius: '12px', padding: '12px', fontSize: '14px', border: 'none', cursor: enviando ? 'not-allowed' : 'pointer', opacity: enviando || !conteudo.trim() ? 0.6 : 1, marginTop: '16px' }}>
              {enviando ? 'A enviar...' : 'Enviar Mensagem'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function MensagemPage() {
  return <PortalAuthProvider><MensagemContent /></PortalAuthProvider>;
}
