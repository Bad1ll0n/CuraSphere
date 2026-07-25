'use client';
import { Inter } from 'next/font/google';
import '../global.css';

const inter = Inter({ subsets: ['latin'] });

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  // NOTA: este é um layout ANINHADO dentro do root layout (app/layout.tsx), que já emite
  // <html>/<body>. Um layout aninhado NUNCA deve emitir os seus próprios <html>/<body> —
  // isso produz HTML inválido (tags aninhadas) e hydration mismatch. Envolvemos em <div>.
  return (
    <div lang="pt" className={inter.className} style={{ background: '#f0f4f8', minHeight: '100vh' }}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: 'var(--bg-card)', borderBottom: '1px solid #e2e8f0', padding: '16px 0' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#3b82f6" />
              <path d="M20 10v20M10 20h20" stroke="white" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b' }}>CuraSphere</span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: '4px' }}>Portal do Doente</span>
          </div>
        </header>
        <main style={{ flex: 1, maxWidth: '480px', margin: '0 auto', width: '100%', padding: '40px 24px' }}>
          {children}
        </main>
        <footer style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--text-dim)' }}>
          © {new Date().getFullYear()} CuraSphere — Portal do Doente
        </footer>
      </div>
    </div>
  );
}
