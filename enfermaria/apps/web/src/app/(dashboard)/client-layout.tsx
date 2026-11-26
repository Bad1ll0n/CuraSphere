'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api, { initCsrf } from '@/lib/api';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useNaoLidasCount } from '@/lib/hooks';
import { useSocket } from '@/lib/use-socket';
import { ToastProvider } from '@/components/toast';
import { filtrarMenus, rotaPermitida } from './nav-data';
import { FilaAlertasCriticos, chaveAlerta, type AlertaCritico } from './sos-banner';
import { useAlertaSonoro } from '@/lib/alerta-sonoro';
import { SocketStatusBanner } from '@/components/socket-status-banner';
import { SidebarNav } from './sidebar-nav';
import { RouteGuard } from './route-guard';
import { ModalConfiguracoes } from './modal-configuracoes';
import { ModalAlterarPassword } from './modal-alterar-password';
import { TourOverlay } from '@/components/tour-overlay';
import { CommandPalette } from '@/components/command-palette';
import { AvisoInatividade, EcraBloqueado, useSessaoPosto } from '@/components/sessao-posto';
import { DarkModeToggle } from '@/components/dark-mode-toggle';
import { KeyboardShortcutsModal } from '@/components/keyboard-shortcuts-modal';
import { NotificationBell } from '@/components/notification-bell';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslations } from 'next-intl';
import { aplicarModos } from '@/lib/modos-turno';
import { NovidadesModal } from '@/components/novidades-modal';
import { PrimeirosPassos } from '@/components/primeiros-passos';
import { gravarOnboarding, lerOnboarding } from '@/lib/onboarding';
import { NOVIDADE_MAIS_RECENTE } from '@/lib/novidades';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { utilizador, loading, logout, passwordAviso } = useAuth();
  const tCommon = useTranslations('common');
  const tLayout = useTranslations('layout');
  const tSessao = useTranslations('session');
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarAberta, setSidebarAberta] = useState(false);

  // UX-30: modos cabeceira/noturno (preferência do posto); o noturno automático acompanha a hora.
  useEffect(() => {
    aplicarModos();
    const t = setInterval(aplicarModos, 60_000);
    return () => clearInterval(t);
  }, []);
  const [modalPwd, setModalPwd] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
  const [mostrarTour, setMostrarTour] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // UX-27: ajuda (visita guiada, primeiros passos, novidades) a partir do menu "?".
  const tAjuda = useTranslations('shortcuts');
  const [forcarPrimeiros, setForcarPrimeiros] = useState(false);
  const [mostrarNovidades, setMostrarNovidades] = useState(false);
  const [novidadePorVer, setNovidadePorVer] = useState(false);
  useEffect(() => {
    if (utilizador?.id) setNovidadePorVer(NOVIDADE_MAIS_RECENTE !== null && lerOnboarding(utilizador.id).novidadesVistas !== NOVIDADE_MAIS_RECENTE);
  }, [utilizador?.id]);
  const abrirNovidades = () => {
    setMostrarNovidades(true); setNovidadePorVer(false);
    if (utilizador?.id) gravarOnboarding(utilizador.id, { ...lerOnboarding(utilizador.id), novidadesVistas: NOVIDADE_MAIS_RECENTE });
  };

  useEffect(() => { initCsrf(); }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName ?? '')) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const { data: notifData } = useNaoLidasCount();
  const naoLidas = notifData?.count ?? 0;

  // UX-11: fila de alertas críticos, persistentes até alguém responder (não se substituem nem
  // desaparecem sozinhos), com som no primeiro e repetido enquanto houver algum por responder.
  const [alertasCriticos, setAlertasCriticos] = useState<AlertaCritico[]>([]);
  useAlertaSonoro(alertasCriticos.filter((a) => a.respondidoPor == null).length);
  // O handshake autentica-se por bilhete pedido com o cookie de sessão (ver use-socket.ts).
  // Antes passava-se aqui `utilizador?.id` na posição do token — não era um token, e o
  // gateway, se o aceitasse, estaria a autenticar por identificador adivinhável.
  const { estado: estadoTempoReal, reconectar: reconectarTempoReal } = useSocket({
    'sos:alerta': (data: AlertaCritico) => {
      setAlertasCriticos((fila) => fila.some((a) => chaveAlerta(a) === chaveAlerta(data)) ? fila : [...fila, data]);
    },
    'alerta:respondido': (r: { alertaId: string; porNome: string | null }) => {
      setAlertasCriticos((fila) => fila.map((a) => a.alertaId === r.alertaId ? { ...a, respondidoPor: r.porNome ?? '' } : a));
    },
  });

  // UX-21: aviso aos 13 min, fim aos 15 (os rascunhos ficam para o mesmo profissional) e bloqueio
  // rápido do posto. Antes: `api.post('/auth/logout')` em silêncio, sem limpar a cache de dados.
  const sessao = useSessaoPosto(utilizador?.id ?? null, () => logout({ manterRascunhos: true, motivo: 'inatividade' }));

  useEffect(() => {
    if (!loading && !utilizador) { router.push('/login'); return; }
    if (!loading && utilizador && pathname === '/dashboard') {
      if (utilizador.role === 'ti') router.replace('/dashboard-ti');
      else if (utilizador.role === 'operacional') router.replace('/operacional');
    }
    if (!loading && utilizador) {
      const chave = `curasphere_tour_${utilizador.id}`;
      if (!localStorage.getItem(chave)) setMostrarTour(true);
    }
  }, [utilizador, loading, router, pathname]);

  if (loading || !utilizador) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 text-slate-500">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">{tCommon('loading')}</span>
      </div>
    </div>
  );

  const itemsVisiveis = filtrarMenus(utilizador);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <a href="#main-content" className="skip-to-content">
        {tLayout('skipToContent')}
      </a>

      {sidebarAberta && (
        <div role="presentation"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={() => setSidebarAberta(false)}
        />
      )}

      {alertasCriticos.length > 0 && (
        <FilaAlertasCriticos alertas={alertasCriticos}
          onResponder={(a) => {
            setAlertasCriticos((fila) => fila.map((x) => chaveAlerta(x) === chaveAlerta(a) ? { ...x, respondidoPor: utilizador?.nome ?? '' } : x));
            api.patch(`/alertas/${a.alertaId}/acusar`).catch(() => {
              setAlertasCriticos((fila) => fila.map((x) => chaveAlerta(x) === chaveAlerta(a) ? { ...x, respondidoPor: null } : x));
            });
          }}
          onFechar={(a) => setAlertasCriticos((fila) => fila.filter((x) => chaveAlerta(x) !== chaveAlerta(a)))} />
      )}

      {mostrarTour && utilizador && (
        <TourOverlay role={utilizador.role} onConcluir={() => {
          localStorage.setItem(`curasphere_tour_${utilizador.id}`, 'done');
          setMostrarTour(false);
        }} />
      )}

      {sessao.bloqueado && (
        <EcraBloqueado nome={utilizador.nome} alertasCriticos={alertasCriticos.filter((a) => a.respondidoPor == null).length}
          onDesbloqueado={sessao.desbloqueado} onTrocarUtilizador={() => { sessao.desbloqueado(); logout({ manterRascunhos: true }); }} />
      )}
      {!sessao.bloqueado && sessao.avisoSegundos != null && (
        <AvisoInatividade segundos={sessao.avisoSegundos} onContinuar={sessao.continuar} onSair={() => logout()} />
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)}
        itens={itemsVisiveis.map((i) => ({ href: i.href, label: i.label }))} utilizadorId={utilizador.id}
        podePesquisarDoentes={rotaPermitida('/doentes', utilizador)} podeAdmitir={rotaPermitida('/doentes/admitir', utilizador)} />
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} novidadePorVer={novidadePorVer}
        onVisita={() => { setShortcutsOpen(false); setMostrarTour(true); }}
        onPrimeirosPassos={() => { setShortcutsOpen(false); setForcarPrimeiros(true); }}
        onNovidades={() => { setShortcutsOpen(false); abrirNovidades(); }} />
      {mostrarNovidades && <NovidadesModal onClose={() => setMostrarNovidades(false)} />}
      <PrimeirosPassos utilizadorId={utilizador.id} role={utilizador.role} forcarAberto={forcarPrimeiros} onFechado={() => setForcarPrimeiros(false)} />

      <SidebarNav
        utilizador={utilizador}
        itemsVisiveis={itemsVisiveis}
        naoLidas={naoLidas}
        pathname={pathname}
        sidebarAberta={sidebarAberta}
        onCloseSidebar={() => setSidebarAberta(false)}
        onOpenConfig={() => setModalConfig(true)}
        onLogout={logout}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
        {/* UX-14: barra no fluxo da página (antes eram controlos `fixed` que tapavam a data, o
            título das Notificações e o seletor de idioma em telemóvel e a 977 px). */}
        <div className="barra-topo sticky top-0 z-30 flex items-center justify-end gap-2 bg-slate-50/95 backdrop-blur border-b border-slate-100"
          style={{ padding: '8px 16px', minHeight: '56px' }}>
          <button
            className="botao-menu md:hidden mr-auto w-10 h-10 bg-[#0f172a] text-white rounded-xl flex items-center justify-center shadow-lg"
            aria-label={tLayout('openMenu')}
            aria-expanded={sidebarAberta}
            aria-controls="sidebar-nav"
            onClick={() => setSidebarAberta((v) => !v)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button type="button" data-tour="ajuda" onClick={() => setShortcutsOpen(true)} aria-label={tAjuda('help')} title={tAjuda('help')}
            className="relative h-10 w-10 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-100">
            ?{novidadePorVer && <span className="sr-only">{tAjuda('newBadge')}</span>}
            {novidadePorVer && <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600" />}
          </button>
          <button type="button" data-tour="bloquear" onClick={sessao.bloquear} title={tSessao('lockHint')} aria-label={tSessao('lock')}
            className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-2" style={{ padding: '0 12px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <span className="hidden sm:inline">{tSessao('lock')}</span>
          </button>
          <NotificationBell />
          <LanguageSwitcher />
          <DarkModeToggle />
        </div>
        <ToastProvider>
          <SocketStatusBanner estado={estadoTempoReal} onReconectar={reconectarTempoReal} />
          {passwordAviso.ativo && (
            <div className="bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-4" style={{ padding: '10px 24px' }}>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-amber-800 font-medium">
                  {passwordAviso.diasRestantes !== null && passwordAviso.diasRestantes <= 0
                    ? tLayout('passwordExpired')
                    : tLayout('passwordExpiresSoon', { days: passwordAviso.diasRestantes ?? 0, plural: (passwordAviso.diasRestantes ?? 1) !== 1 ? 's' : '' })}
                </p>
              </div>
              <Link href="/perfil" className="text-xs font-semibold text-amber-700 underline hover:text-amber-900 shrink-0">
                {tLayout('changePassword')}
              </Link>
            </div>
          )}
          {/* UX-21: com o posto bloqueado, o conteúdo clínico nem fica no DOM. */}
          {!sessao.bloqueado && <RouteGuard>{children}</RouteGuard>}
        </ToastProvider>
      </main>

      {modalConfig && (
        <ModalConfiguracoes
          onClose={() => setModalConfig(false)}
          onAlterarPassword={() => setModalPwd(true)}
        />
      )}

      {modalPwd && (
        <ModalAlterarPassword onClose={() => setModalPwd(false)} />
      )}
    </div>
  );
}
