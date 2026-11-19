'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PortalAuthProvider, usePortalAuth, portalFetch } from '../../portal-auth-context';

interface PlanoPortal {
  dataAlvoDia: string | null;
  notas: string | null;
  ensinos: { tema: string; titulo: string; destinatario: string; realizadoEm: string; pontos: string[] }[];
}

const cartao = { background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' } as const;
const rotulo = { fontSize: '12px', fontWeight: 600, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' } as const;

/**
 * Plano de alta no portal do doente. A página lia campos que a API nunca enviou
 * (`dataAltaPrevista`, `resumo`, `instrucoes`) e mostrava-se sempre vazia; passa a mostrar a
 * data prevista, as notas e — PROD-13 — o que foi ensinado ao doente e ao cuidador, para rever em casa.
 */
function PlanoAltaContent() {
  const t = useTranslations('portalDischarge');
  const { autenticado, loading: authLoading } = usePortalAuth();
  const [plano, setPlano] = useState<PlanoPortal | null>(null);
  const [erro, setErro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!autenticado) return;
    portalFetch('/portal/plano-alta').then(setPlano).catch(() => setErro(true)).finally(() => setLoading(false));
  }, [autenticado]);

  if (authLoading) return null;

  if (!autenticado) { if (typeof window !== 'undefined') window.location.href = '/portal/login'; return null; }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <Link href="/portal" style={{ textDecoration: 'none', color: 'var(--text-soft)', fontSize: '13px' }}>{t('back')}</Link>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>{t('title')}</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)', fontSize: '14px' }}>{t('loading')}</div>
      ) : erro ? (
        <div role="alert" style={{ textAlign: 'center', padding: '40px', color: '#b91c1c', fontSize: '14px' }}>{t('loadError')}</div>
      ) : !plano ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)', fontSize: '14px' }}>{t('empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {plano.dataAlvoDia && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', padding: '20px' }}>
              <p style={{ ...rotulo, color: '#1d4ed8', marginBottom: '6px' }}>{t('expectedDate')}</p>
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>
                {new Date(plano.dataAlvoDia).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
          {plano.notas && (
            <div style={cartao}>
              <p style={rotulo}>{t('notes')}</p>
              <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{plano.notas}</p>
            </div>
          )}
          <div style={cartao}>
            <p style={rotulo}>{t('teachings')}</p>
            {plano.ensinos.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--text-dim)' }}>{t('noTeachings')}</p>
            ) : (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', listStyle: 'none', padding: 0, margin: 0 }}>
                {plano.ensinos.map((e) => (
                  <li key={e.titulo}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{e.titulo}</p>
                    {e.pontos.length > 0 && (
                      <ul style={{ fontSize: '13px', color: '#475569', paddingLeft: '18px', lineHeight: '1.6' }}>
                        {e.pontos.map((p) => <li key={p}>{p}</li>)}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlanoAltaPage() {
  return <PortalAuthProvider><PlanoAltaContent /></PortalAuthProvider>;
}
