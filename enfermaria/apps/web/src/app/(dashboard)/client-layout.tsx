'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../lib/auth-context';

const navItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    roles: ['administrativo', 'chefe_enfermeiros', 'chefe_turno', 'enfermeiro', 'medico', 'auxiliar'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/doentes',
    label: 'Doentes',
    roles: ['administrativo', 'chefe_enfermeiros', 'chefe_turno', 'enfermeiro', 'medico', 'auxiliar'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/camas',
    label: 'Camas',
    roles: ['administrativo', 'chefe_enfermeiros', 'chefe_turno'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    href: '/horarios',
    label: 'Horários',
    roles: ['administrativo', 'chefe_enfermeiros', 'chefe_turno', 'enfermeiro', 'medico', 'auxiliar'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/tarefas',
    label: 'Tarefas',
    roles: ['enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'auxiliar'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8h.01M9 16h.01m6-4h-3" />
      </svg>
    ),
  },
  {
    href: '/trocas',
    label: 'Trocas de Turno',
    roles: ['enfermeiro', 'auxiliar', 'medico', 'chefe_enfermeiros'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    href: '/atribuicoes',
    label: 'Atribuições',
    roles: ['enfermeiro', 'chefe_enfermeiros', 'chefe_turno', 'medico'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    href: '/utilizadores',
    label: 'Utilizadores',
    roles: ['chefe_enfermeiros'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
];

const roleLabel: Record<string, string> = {
  enfermeiro: 'Enfermeiro',
  auxiliar: 'Auxiliar',
  medico: 'Médico',
  chefe_turno: 'Chefe de Turno',
  chefe_enfermeiros: 'Chefe de Enfermeiros',
  administrativo: 'Administrativo',
};

const roleColor: Record<string, string> = {
  enfermeiro: 'bg-teal-500/15 text-teal-400',
  auxiliar: 'bg-slate-500/15 text-slate-400',
  medico: 'bg-violet-500/15 text-violet-400',
  chefe_turno: 'bg-amber-500/15 text-amber-400',
  chefe_enfermeiros: 'bg-blue-500/15 text-blue-400',
  administrativo: 'bg-pink-500/15 text-pink-400',
};

function Avatar({ nome }: { nome: string }) {
  const initials = nome.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md">
      {initials}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { utilizador, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !utilizador) router.push('/login');
  }, [utilizador, loading, router]);

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

  const itemsVisiveis = navItems.filter((item) => item.roles.includes(utilizador.role));

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-[#0f172a] flex flex-col border-r border-white/5">
        {/* Logo */}
        <div className="border-b border-white/5 flex items-center justify-center" style={{ paddingTop: '28px', paddingBottom: '24px' }}>
          <div className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="CuraSphere" width={36} height={36} />
            <div>
              <p className="text-white font-bold text-base leading-none tracking-tight">CuraSphere</p>
              <p className="text-slate-500 text-[10px] mt-1">Gestão Hospitalar</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto" style={{ paddingTop: '28px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px' }}>
          <p className="text-slate-600 text-[10px] font-semibold uppercase tracking-widest" style={{ marginBottom: '12px', paddingLeft: '12px' }}>Menu</p>
          {itemsVisiveis.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{ marginBottom: '8px', display: 'flex' }}
                className={`group items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`transition-colors ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
                  {item.icon}
                </span>
                {item.label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Perfil */}
        <div className="border-t border-white/5" style={{ padding: '16px 20px' }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1">
            <Avatar nome={utilizador.nome} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate leading-tight">{utilizador.nome}</p>
              <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-0.5 ${roleColor[utilizador.role] ?? 'bg-slate-500/15 text-slate-400'}`}>
                {roleLabel[utilizador.role] ?? utilizador.role}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-red-400 hover:bg-red-400/5 rounded-xl text-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Terminar sessão
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
