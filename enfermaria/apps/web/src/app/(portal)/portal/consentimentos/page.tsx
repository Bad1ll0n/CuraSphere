'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PortalAuthProvider, usePortalAuth, portalFetch } from '../../portal-auth-context';

/** SEC-19 — o doente vê e gere as suas decisões sobre o tratamento dos seus dados. */
interface Finalidade {
  finalidade: 'partilha_familiares' | 'portal_doente' | 'ia_clinica';
  regime: 'consentimento' | 'oposicao';
  decisao: 'consentimento' | 'oposicao' | null;
  registadoEm: string | null;
  permitido: boolean;
}

const TEXTO: Record<Finalidade['finalidade'], { titulo: string; explicacao: string }> = {
  partilha_familiares: {
    titulo: 'Partilha com familiares',
    explicacao: 'A equipa pode enviar a um familiar um link que mostra o seu estado geral (sem dados clínicos detalhados). Ao revogar, os links activos deixam de funcionar.',
  },
  portal_doente: {
    titulo: 'Conta no portal',
    explicacao: 'Esta conta dá-lhe acesso remoto aos seus documentos, medicação e plano de alta. Se revogar, a conta é desactivada e termina a sessão; para voltar a ter acesso tem de o pedir à equipa.',
  },
  ia_clinica: {
    titulo: 'Ferramentas de inteligência artificial',
    explicacao: 'A equipa pode usar ferramentas de IA para preparar resumos e rascunhos, sempre revistos por um profissional. São enviados dados clínicos sem o seu nome, NIF ou contactos. Pode opor-se, e a equipa trabalhará sem essas ferramentas no seu caso.',
  },
};

function ConsentimentosContent() {
  const { autenticado, loading: authLoading } = usePortalAuth();
  const [finalidades, setFinalidades] = useState<Finalidade[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState<string | null>(null);

  const carregar = useCallback(() => {
    portalFetch('/portal/consentimentos').then((r) => setFinalidades(r.finalidades)).catch(() => setFinalidades([]));
  }, []);
  useEffect(() => { if (autenticado) carregar(); }, [autenticado, carregar]);

  if (authLoading) return null;
  if (!autenticado) { if (typeof window !== 'undefined') window.location.href = '/portal/login'; return null; }

  const agir = async (f: Finalidade, accao: 'consentimento' | 'oposicao' | 'revogar') => {
    const t = TEXTO[f.finalidade];
    const pergunta = accao === 'revogar'
      ? (f.regime === 'oposicao' ? `Retirar a sua oposição a: ${t.titulo}?` : `Revogar o seu consentimento para: ${t.titulo}?`)
      : accao === 'consentimento' ? `Dar o seu consentimento para: ${t.titulo}?` : `Opor-se a: ${t.titulo}?`;
    if (!window.confirm(pergunta)) return;
    setAGuardar(f.finalidade); setErro(null);
    try {
      if (accao === 'revogar') {
        const r = await portalFetch(`/portal/consentimentos/${f.finalidade}/revogar`, { method: 'POST' });
        if (r?.contaPortalDesactivada) { window.location.href = '/portal/login'; return; }
      } else {
        await portalFetch('/portal/consentimentos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ finalidade: f.finalidade, decisao: accao }),
        });
      }
      carregar();
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível guardar a sua decisão.');
    } finally { setAGuardar(null); }
  };

  const botao = (cor: 'primario' | 'neutro') => ({
    padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    ...(cor === 'primario'
      ? { background: '#2563eb', color: '#fff', border: 'none' }
      : { background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color, #e2e8f0)' }),
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <Link href="/portal" style={{ textDecoration: 'none', color: 'var(--text-soft)', fontSize: '13px' }}>← Voltar</Link>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>Os Meus Consentimentos</h1>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-soft)', marginBottom: '24px', lineHeight: 1.6 }}>
        Os seus cuidados de saúde não dependem destas escolhas. Pode alterá-las a qualquer momento, e cada alteração fica registada com data e hora.
      </p>
      {erro && <p role="alert" style={{ background: '#fef2f2', color: '#991b1b', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>{erro}</p>}
      {finalidades === null ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)', fontSize: '14px' }}>A carregar...</div>
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '16px', listStyle: 'none', padding: 0 }}>
          {finalidades.map((f) => {
            const t = TEXTO[f.finalidade];
            const estado = f.regime === 'oposicao'
              ? (f.decisao === 'oposicao' ? 'Opôs-se' : 'Sem oposição')
              : (f.decisao === 'consentimento' ? 'Consentimento dado' : f.decisao === 'oposicao' ? 'Recusado' : 'Sem consentimento');
            return (
              <li key={f.finalidade} style={{ background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>{t.titulo}</h2>
                  <span style={{ fontSize: '12px', fontWeight: 600, borderRadius: '999px', padding: '2px 10px', background: f.permitido ? '#ecfdf5' : '#fffbeb', color: f.permitido ? '#047857' : '#92400e' }}>{estado}</span>
                  {f.registadoEm && <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>desde {new Date(f.registadoEm).toLocaleDateString('pt-PT')}</span>}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-soft)', lineHeight: 1.6, marginBottom: '12px' }}>{t.explicacao}</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {f.regime === 'consentimento' && f.decisao !== 'consentimento' && f.finalidade !== 'portal_doente' && (
                    <button disabled={aGuardar === f.finalidade} onClick={() => agir(f, 'consentimento')} style={botao('primario')}>Dar consentimento</button>
                  )}
                  {f.regime === 'oposicao' && f.decisao !== 'oposicao' && (
                    <button disabled={aGuardar === f.finalidade} onClick={() => agir(f, 'oposicao')} style={botao('neutro')}>Opor-me</button>
                  )}
                  {f.decisao && (
                    <button disabled={aGuardar === f.finalidade} onClick={() => agir(f, 'revogar')} style={botao('neutro')}>
                      {f.regime === 'oposicao' ? 'Retirar oposição' : f.decisao === 'consentimento' ? 'Revogar consentimento' : 'Anular recusa'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function ConsentimentosPage() {
  return <PortalAuthProvider><ConsentimentosContent /></PortalAuthProvider>;
}
