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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { utilizador, loading, logout, passwordAviso } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [modalPwd, setModalPwd] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvandoPwd, setSalvandoPwd] = useState(false);
  const [pwdErro, setPwdErro] = useState('');
  const [pwdSucesso, setPwdSucesso] = useState(false);

  const [modalConfig, setModalConfig] = useState(false);
  const [tema, setTema] = useState<'light'|'dark'>('light');

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
    const saved = localStorage.getItem('curasphere-theme') as 'light'|'dark'|null;
    if (saved) setTema(saved);
  }, []);

  const aplicarTema = (t: 'light'|'dark') => {
    setTema(t);
    localStorage.setItem('curasphere-theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  };

  const alterarPassword = async () => {
    if (novaSenha !== confirmarSenha) { setPwdErro('As passwords não coincidem'); return; }
    if (novaSenha.length < 6) { setPwdErro('A nova password deve ter pelo menos 6 caracteres'); return; }
    setSalvandoPwd(true); setPwdErro('');
    try {
      await api.patch('/auth/alterar-password', { passwordAtual: senhaAtual, novaPassword: novaSenha });
      setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha(''); setPwdSucesso(true);
    } catch (e: any) {
      setPwdErro(e.response?.data?.message ?? 'Erro ao alterar password');
    } finally { setSalvandoPwd(false); }
  };

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
    const servicoOk         = !item.servicos || item.servicos.includes(utilizador.servico ?? 'internamento');
    const roleOk            = !item.roles    || item.roles.includes(utilizador.role);
    const subRoleOk         = !(item as any).subRoles       || (item as any).subRoles.includes(utilizador.subRole);
    const notExcluded       = !(item as any).excludeSubRoles  || !(item as any).excludeSubRoles.includes(utilizador.subRole);
    const notExcludedServico = !(item as any).excludeServicos || !(item as any).excludeServicos.includes(utilizador.servico ?? 'internamento');
    return servicoOk && roleOk && subRoleOk && notExcluded && notExcludedServico;
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Overlay mobile */}
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

      {/* Conteúdo */}
      <main className="flex-1 overflow-auto">
        {/* Hamburger — só mobile */}
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

      {/* Modal: Configurações */}
      {modalConfig && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalConfig(false); }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="modal-config-titulo"
            className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '380px', padding: '28px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 id="modal-config-titulo" className="text-lg font-bold text-slate-900">Configurações</h2>
              <button onClick={() => setModalConfig(false)} aria-label="Fechar configurações" className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
            </div>

            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest" style={{ marginBottom: '12px' }}>Tema</p>
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '28px' }}>
              <button
                onClick={() => aplicarTema('light')}
                className={`flex flex-col items-center gap-2 border-2 rounded-xl transition-all ${tema === 'light' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                style={{ padding: '16px 12px' }}
              >
                <svg className={`w-6 h-6 ${tema === 'light' ? 'text-blue-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
                <span className={`text-sm font-semibold ${tema === 'light' ? 'text-blue-600' : 'text-slate-500'}`}>Claro</span>
              </button>
              <button
                onClick={() => aplicarTema('dark')}
                className={`flex flex-col items-center gap-2 border-2 rounded-xl transition-all ${tema === 'dark' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                style={{ padding: '16px 12px' }}
              >
                <svg className={`w-6 h-6 ${tema === 'dark' ? 'text-blue-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span className={`text-sm font-semibold ${tema === 'dark' ? 'text-blue-600' : 'text-slate-500'}`}>Escuro</span>
              </button>
            </div>

            <div className="border-t border-slate-100" style={{ paddingTop: '20px' }}>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest" style={{ marginBottom: '12px' }}>Conta</p>
              <button
                onClick={() => { setModalConfig(false); setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha(''); setPwdErro(''); setModalPwd(true); }}
                className="w-full flex items-center gap-3 text-sm text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                style={{ padding: '10px 14px' }}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Alterar Password
                <svg className="w-4 h-4 ml-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Alterar Password */}
      {modalPwd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onKeyDown={e => { if (e.key === 'Escape') { setModalPwd(false); setPwdSucesso(false); } }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="modal-pwd-titulo"
            className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '400px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 id="modal-pwd-titulo" className="text-lg font-bold text-slate-900">Alterar Password</h2>
              <button onClick={() => { setModalPwd(false); setPwdSucesso(false); }} aria-label="Fechar"
                className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            {pwdSucesso ? (
              <div className="bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm text-center" style={{ padding: '16px', marginBottom: '16px' }}>
                Password alterada com sucesso!
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="pwd-atual" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Password Atual</label>
                  <input id="pwd-atual" type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 14px' }} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="pwd-nova" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Nova Password</label>
                  <input id="pwd-nova" type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 14px' }} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label htmlFor="pwd-confirmar" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Confirmar Nova Password</label>
                  <input id="pwd-confirmar" type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)}
                    aria-describedby={pwdErro ? 'pwd-erro' : undefined}
                    className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 14px' }} />
                </div>
                {pwdErro && <p id="pwd-erro" role="alert" className="text-red-600 text-sm" style={{ marginBottom: '12px' }}>{pwdErro}</p>}
                <div className="flex gap-3" style={{ marginTop: '8px' }}>
                  <button onClick={() => setModalPwd(false)}
                    className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                    style={{ padding: '11px' }}>Cancelar</button>
                  <button onClick={alterarPassword} disabled={salvandoPwd || !senhaAtual || !novaSenha || !confirmarSenha}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                    style={{ padding: '11px' }}>
                    {salvandoPwd ? 'A guardar...' : 'Guardar'}
                  </button>
                </div>
              </>
            )}
            {pwdSucesso && (
              <button onClick={() => { setModalPwd(false); setPwdSucesso(false); }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
                style={{ padding: '11px' }}>Fechar</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
