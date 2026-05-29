'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useSocket } from '@/lib/use-socket';
import { ToastProvider } from '@/components/toast';
import { navItems } from './nav-data';
import { SosBanner } from './sos-banner';
import { SidebarNav } from './sidebar-nav';
import { ModalConfiguracoes } from './modal-configuracoes';
import { ModalAlterarPassword } from './modal-alterar-password';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { utilizador, loading, logout, passwordAviso } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [modalPwd, setModalPwd] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);

  const { data: notifData } = useQuery<{ count: number }>({
    queryKey: ['notificacoes-count'],
    queryFn: () => api.get('/notificacoes/nao-lidas').then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
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

  useEffect(() => {
    if (!loading && !utilizador) { router.push('/login'); return; }
    if (!loading && utilizador && pathname === '/dashboard') {
      if (utilizador.role === 'ti') router.replace('/dashboard-ti');
      else if (utilizador.role === 'operacional') router.replace('/operacional');
    }
  }, [utilizador, loading, router, pathname]);

  if (loading || !utilizador) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 text-slate-400">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">A carregar...</span>
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

      <SidebarNav
        utilizador={utilizador}
        itemsVisiveis={itemsVisiveis}
        naoLidas={naoLidas}
        pathname={pathname}
        sidebarAberta={sidebarAberta}
        onCloseSidebar={() => setSidebarAberta(false)}
        onOpenConfig={() => setModalConfig(true)}
        onLogout={logout}
      />

      <main className="flex-1 overflow-auto">
        <button
          className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-[#0f172a] text-white rounded-xl flex items-center justify-center shadow-lg"
          aria-label="Abrir menu"
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
                    ? 'A tua password expirou. Altera-a agora para continuar a aceder.'
                    : `A tua password expira em ${passwordAviso.diasRestantes} dia${passwordAviso.diasRestantes !== 1 ? 's' : ''}. Altera-a brevemente.`}
                </p>
              </div>
              <Link href="/perfil" className="text-xs font-semibold text-amber-700 underline hover:text-amber-900 shrink-0">
                Alterar password
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
