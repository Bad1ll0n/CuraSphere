'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { destinoPorOmissao, rotaPermitida } from './nav-data';

/**
 * Camada 2 do controlo de acessos, montada uma única vez no layout do dashboard e por isso
 * activa em **todas** as rotas do grupo — a barra lateral já escondia os menus proibidos,
 * mas escrever o URL directamente contornava-a por completo.
 *
 * A decisão vem de `rotaPermitida`, que reutiliza a mesma `menuVisivel` do menu: uma só
 * fonte de verdade, sem hipótese de o menu e a guarda divergirem. Continua a ser defesa em
 * profundidade — a autoridade é o `RolesGuard` da API; isto evita a renderização e os
 * pedidos que o servidor recusaria.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { utilizador, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('errors');

  const permitido = !utilizador || rotaPermitida(pathname, utilizador);

  useEffect(() => {
    if (loading || !utilizador || permitido) return;
    router.replace(destinoPorOmissao(utilizador));
  }, [loading, utilizador, permitido, router]);

  if (permitido) return <>{children}</>;

  // Estado de permissão insuficiente enquanto a redirecção não acontece — anunciado a
  // leitores de ecrã em vez de um ecrã em branco silencioso.
  return (
    <div role="alert" style={{ padding: '64px 48px', maxWidth: '640px', margin: '0 auto' }}>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center" style={{ padding: '48px 32px' }}>
        <div
          className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center"
          style={{ margin: '0 auto 20px' }}
        >
          <svg className="w-6 h-6 text-amber-600" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-slate-900" style={{ marginBottom: '8px' }}>
          {t('forbiddenTitle')}
        </h1>
        <p className="text-sm text-slate-500">{t('forbiddenBody')}</p>
      </div>
    </div>
  );
}
