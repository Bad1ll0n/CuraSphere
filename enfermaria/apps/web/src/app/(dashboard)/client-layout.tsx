'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api, { initCsrf } from '@/lib/api';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useNaoLidasCount } from '@/lib/hooks';
import { useSocket } from '@/lib/use-socket';
import { ToastProvider } from '@/components/toast';
import { navItems } from './nav-data';
import { SosBanner } from './sos-banner';
import { SidebarNav } from './sidebar-nav';
import { ModalConfiguracoes } from './modal-configuracoes';
import { ModalAlterarPassword } from './modal-alterar-password';
import { TourOverlay } from '@/components/tour-overlay';
import { CommandPalette } from '@/components/command-palette';
import { DarkModeToggle } from '@/components/dark-mode-toggle';
import { KeyboardShortcutsModal } from '@/components/keyboard-shortcuts-modal';
import { NotificationBell } from '@/components/notification-bell';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslations } from 'next-intl';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { utilizador, loading, logout, passwordAviso } = useAuth();
  const tCommon = useTranslations('common');
  const tLayout = useTranslations('layout');
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [modalPwd, setModalPwd] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
  const [mostrarTour, setMostrarTour] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

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

  const [sosAlerta, setSosAlerta] = useState<{ doenteId: string; doenteNome: string; quarto: string; acionadoPor: string } | null>(null);
  const sosTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useSocket(utilizador?.id, {
    'sos:alerta': (data) => {
      setSosAlerta(data);
      if (sosTimeoutRef.current) clearTimeout(sosTimeoutRef.current);
      sosTimeoutRef.current = setTimeout(() => setSosAlerta(null), 30000);
    },
  });

  const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(async () => {
      try {
        await api.post('/auth/logout');
      } catch { /* ignore */ }
      router.push('/login');
    }, IDLE_TIMEOUT_MS);
  }, [router]);

  useEffect(() => {
    resetIdleTimer();
    const events = ['mousemove', 'keydown', 'click', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
    };
  }, [resetIdleTimer]);

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
      <div className="flex items-center gap-3 text-slate-400">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">{tCommon('loading')}</span>
      </div>
    </div>
  );

  const itemsVisiveis = navItems.filter((item) => {
    const servicoOk          = !item.servicos || item.servicos.includes(utilizador.servico ?? 'internamento');
    const roleOk             = !item.roles    || item.roles.includes(utilizador.role);
    const subRoleOk          = !(item as any).subRoles        || (item as any).subRoles.includes(utilizador.subRole);
    const notExcluded        = !(item as any).excludeSubRoles  || !(item as any).excludeSubRoles.includes(utilizador.subRole);
    const notExcludedServico = !(item as any).excludeServicos  || !(item as any).excludeServicos.includes(utilizador.servico ?? 'internamento');
    return servicoOk && roleOk && subRoleOk && notExcluded && notExcludedServico;
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <a href="#main-content" className="skip-to-content">
        {tLayout('skipToContent')}
      </a>

      {sidebarAberta && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={() => setSidebarAberta(false)}
        />
      )}

      {sosAlerta && (
        <SosBanner sosAlerta={sosAlerta} onClose={() => setSosAlerta(null)} />
      )}

      {mostrarTour && utilizador && (
        <TourOverlay role={utilizador.role} onConcluir={() => {
          localStorage.setItem(`curasphere_tour_${utilizador.id}`, 'done');
          setMostrarTour(false);
        }} />
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

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
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <NotificationBell />
          <LanguageSwitcher />
          <DarkModeToggle />
        </div>

        <button
          className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-[#0f172a] text-white rounded-xl flex items-center justify-center shadow-lg"
          aria-label={tLayout('openMenu')}
          aria-expanded={sidebarAberta}
          aria-controls="sidebar-nav"
          onClick={() => setSidebarAberta((v) => !v)}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <ToastProvider>
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
          {children}
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
