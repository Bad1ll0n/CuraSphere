'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { destinoPorOmissao, rotaPermitida } from './nav-data';
import { moduloDaRotaWeb } from '@org/shared';
import { useModulosDesligados } from '@/lib/hooks/use-modulos';
import { Button } from '@/components/ui';

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

  // PROD-20: um módulo opcional desligado nesta instalação conta como rota indisponível.
  const modulosDesligados = useModulosDesligados();
  const modulo = moduloDaRotaWeb(pathname);
  const desligado = !!modulo && modulosDesligados.has(modulo.id);
  const permitido = !utilizador || (rotaPermitida(pathname, utilizador) && !desligado);

  // UX-23: a recusa diz-se — antes o redirecionamento era imediato e a mensagem só piscava (o
  // administrativo em /doentes/admitir ia parar ao dashboard sem saber porquê). Fica 6 s, com
  // um botão para ir já.
  const destino = utilizador ? destinoPorOmissao(utilizador) : '/';
  useEffect(() => {
    if (loading || !utilizador || permitido) return;
    const t = setTimeout(() => router.replace(destino), 6000);
    return () => clearTimeout(t);
  }, [loading, utilizador, permitido, router, destino]);

  if (permitido) return <>{children}</>;

  // Estado de permissão insuficiente enquanto a redireção não acontece — anunciado a
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
          {desligado ? t('moduleOffTitle') : t('forbiddenTitle')}
        </h1>
        <p className="text-sm text-slate-500">{desligado ? t('moduleOffBody') : t('forbiddenBody')}</p>
        <Button variant="primary" type="button" onClick={() => router.replace(destino)}
           style={{ marginTop: '20px', padding: '8px 16px' }}>
          {t('forbiddenGoHome')}
        </Button>
      </div>
    </div>
  );
}
