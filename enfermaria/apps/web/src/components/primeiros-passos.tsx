'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { gravarOnboarding, lerOnboarding, primeirosPassosDoPapel, registarVisita, type EstadoOnboarding } from '@/lib/onboarding';

/**
 * UX-27 — "Primeiros passos" do papel: uma lista curta de ecrãs a conhecer (o meu turno, o MAR,
 * a ficha…) que se marcam sozinhos quando o profissional os abre. Some quando está completa ou
 * quando é fechada; volta pelo menu "?".
 */
export function PrimeirosPassos({ utilizadorId, role, forcarAberto, onFechado }: {
  utilizadorId: string; role: string; forcarAberto: boolean; onFechado: () => void;
}) {
  const t = useTranslations('onboarding');
  const pathname = usePathname();
  const passos = primeirosPassosDoPapel(role);
  const [estado, setEstado] = useState<EstadoOnboarding | null>(null);
  // Começa recolhido: um cartão pequeno que não tapa nada; a lista abre com um clique.
  const [aberto, setAberto] = useState(false);

  useEffect(() => { setEstado(lerOnboarding(utilizadorId)); }, [utilizadorId]);

  useEffect(() => {
    if (!estado || !pathname) return;
    const novo = registarVisita(estado, passos, pathname);
    if (novo !== estado) { setEstado(novo); gravarOnboarding(utilizadorId, novo); }
  }, [pathname, estado, passos, utilizadorId]);

  useEffect(() => {
    if (forcarAberto && estado?.fechado) {
      const novo = { ...estado, fechado: false };
      setEstado(novo); gravarOnboarding(utilizadorId, novo);
    }
    if (forcarAberto) setAberto(true);
  }, [forcarAberto, estado, utilizadorId]);

  if (!estado || passos.length === 0 || estado.fechado) return null;
  const feitos = passos.filter((p) => estado.visitados.includes(p.id)).length;
  if (feitos === passos.length && !forcarAberto) return null;

  const fechar = () => { const novo = { ...estado, fechado: true }; setEstado(novo); gravarOnboarding(utilizadorId, novo); onFechado(); };

  return (
    <aside aria-label={t('title')} className="fixed z-30 bg-white border border-slate-200 rounded-2xl shadow-lg" style={{ right: 16, bottom: 16, width: aberto ? 280 : 'auto' }}>
      <div className="flex items-center justify-between" style={{ padding: '10px 14px' }}>
        <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="text-sm font-semibold text-slate-800">
          {t('title')} · {feitos}/{passos.length}
        </button>
        <button type="button" onClick={fechar} aria-label={t('close')} className="text-slate-400 hover:text-slate-600" style={{ padding: '2px 6px' }}>✕</button>
      </div>
      {aberto && (
        <ol className="text-sm" style={{ padding: '0 14px 12px', margin: 0, listStyle: 'none' }}>
          {passos.map((p) => {
            const feito = estado.visitados.includes(p.id);
            const destino = p.rota.endsWith('/') ? p.rota.slice(0, -1) : p.rota;
            return (
              <li key={p.id} className="flex items-center gap-2" style={{ padding: '4px 0' }}>
                <span aria-hidden="true" className={feito ? 'text-emerald-600' : 'text-slate-300'}>{feito ? '✓' : '○'}</span>
                <Link href={destino} className={feito ? 'text-slate-400 line-through' : 'text-blue-700 hover:underline'}>{t(`primeiro.${p.id}`)}</Link>
                <span className="sr-only">{feito ? t('done') : t('todo')}</span>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
