'use client';
import { useState } from 'react';
import { PortalAuthProvider, usePortalAuth } from '../../portal-auth-context';

function LoginForm() {
  const { login } = usePortalAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const submeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      await login(email, senha);
    } catch (err: any) {
      setErro(err?.message ?? 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Aceder ao Meu Portal</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-soft)' }}>Consulte os seus documentos, medicação e informações de saúde</p>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
        <form onSubmit={submeter}>
          <div style={{ marginBottom: '16px' }}>
            <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="o-seu-email@exemplo.com"
              required
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Password
            </span>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '11px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {erro && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', color: 'var(--danger)', fontSize: '13px', marginBottom: '16px' }}>
              {erro}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: '#3b82f6', color: '#fff', fontWeight: 600, borderRadius: '12px', padding: '12px', fontSize: '14px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'A entrar...' : 'Entrar'}
          </button>
        </form>
      </div>

      <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-dim)', marginTop: '20px' }}>
        As suas credenciais foram fornecidas pela equipa clínica.<br />Em caso de dúvida, contacte o hospital.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <PortalAuthProvider>
      <LoginForm />
    </PortalAuthProvider>
  );
}
