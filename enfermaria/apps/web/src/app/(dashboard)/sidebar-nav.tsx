'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Avatar, navItems, roleLabel, subRoleLabel, servicoLabel, roleColor } from './nav-data';

// Deriva a chave de tradução a partir do href (ex.: '/dashboard-executivo' -> 'dashboardExecutivo').
// Igual à chave usada no namespace navItems dos catálogos pt/en.
function navKey(href: string): string {
  return href.replace(/^\//, '').replace(/[/-]([a-z])/g, (_, c: string) => c.toUpperCase()).replace(/[/-]/g, '');
}

interface SidebarUtilizador {
  nome: string;
  role: string;
  subRole?: string | null;
  servico?: string | null;
}

interface SidebarNavProps {
  utilizador: SidebarUtilizador;
  itemsVisiveis: typeof navItems;
  naoLidas: number;
  pathname: string;
  sidebarAberta: boolean;
  onCloseSidebar: () => void;
  onOpenConfig: () => void;
  onLogout: () => void;
  onOpenPalette?: () => void;
}

export function SidebarNav({
  utilizador,
  itemsVisiveis,
  naoLidas,
  pathname,
  sidebarAberta,
  onCloseSidebar,
  onOpenConfig,
  onLogout,
  onOpenPalette,
}: SidebarNavProps) {
  const t = useTranslations('navItems');
  const n = useTranslations('nav');
  const label = (item: { href: string; label: string }) => {
    const k = navKey(item.href);
    return t.has(k) ? t(k) : item.label;
  };
  return (
    <aside
      id="sidebar-nav"
      aria-label={n('mainNav')}
      className={`w-64 shrink-0 bg-[#0f172a] flex flex-col border-r border-white/5 fixed md:relative inset-y-0 left-0 z-40 transform transition-transform duration-200 ${
        sidebarAberta ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}
    >
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

      {/* Pesquisa rápida */}
      {onOpenPalette && (
        <div style={{ paddingLeft: '20px', paddingRight: '20px', paddingTop: '16px', paddingBottom: '4px' }}>
          <button
            onClick={onOpenPalette}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-500 bg-white/5 hover:bg-white/10 transition-all"
            aria-label="Pesquisa rápida (Ctrl+K)"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="flex-1 text-left text-slate-500">{n('search')}</span>
            <kbd className="hidden md:flex items-center gap-0.5 text-[10px] text-slate-600 font-mono">
              <span>⌘</span><span>K</span>
            </kbd>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto" style={{ paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px' }}>
        {(['A', 'B', 'C', 'D'] as const).reduce<React.ReactNode[]>((acc, grupo) => {
          const GRUPO_LABELS: Record<string, string> = { A: n('groupDashboards'), B: n('groupWork'), C: n('groupPersonal'), D: n('groupComms') };
          const items = itemsVisiveis.filter(i => i.grupo === grupo).sort((a, b) => label(a).localeCompare(label(b)));
          if (items.length === 0) return acc;
          acc.push(
            <p
              key={`label-${grupo}`}
              className="text-slate-600 text-[10px] font-semibold uppercase tracking-widest"
              style={{ marginBottom: '8px', paddingLeft: '12px', marginTop: acc.length > 0 ? '20px' : '0' }}
            >
              {GRUPO_LABELS[grupo]}
            </p>
          );
          items.forEach(item => {
            const active = pathname === item.href;
            acc.push(
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={onCloseSidebar}
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
                {label(item)}
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
              </Link>
            );
          });
          return acc;
        }, [])}
      </nav>

      {/* Perfil */}
      <div className="border-t border-white/5" style={{ padding: '12px 16px' }}>
        <div className="rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.06)', padding: '12px 14px', marginBottom: '6px' }}>
          <div className="flex items-center gap-3">
            <Avatar nome={utilizador.nome} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-[13px] font-semibold truncate leading-snug">{utilizador.nome}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`shrink-0 text-[10px] font-semibold badge-pad py-0.5 rounded-full ${roleColor[utilizador.role] ?? 'bg-slate-500/15 text-slate-400'}`}>
                  {roleLabel[utilizador.role] ?? utilizador.role}
                </span>
                {utilizador.subRole && (
                  <span className="text-[10px] text-slate-400 truncate">
                    {subRoleLabel[utilizador.subRole] ?? utilizador.subRole}
                  </span>
                )}
              </div>
              {utilizador.servico && (
                <p className="text-[10px] text-slate-600 mt-1 truncate">
                  {servicoLabel[utilizador.servico] ?? utilizador.servico}
                </p>
              )}
            </div>
          </div>
        </div>

        <Link
          href="/notificacoes"
          onClick={onCloseSidebar}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/5 rounded-lg text-[13px] transition-all"
        >
          <div className="relative w-4 h-4 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {naoLidas > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {naoLidas > 9 ? '9+' : naoLidas}
              </span>
            )}
          </div>
          {n('notifications')} {naoLidas > 0 && <span className="ml-auto text-[10px] font-bold text-red-500">{naoLidas}</span>}
        </Link>

        <Link
          href="/perfil"
          onClick={onCloseSidebar}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/5 rounded-lg text-[13px] transition-all"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {n('profile')}
        </Link>

        <button
          onClick={onOpenConfig}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/5 rounded-lg text-[13px] transition-all"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {n('settings')}
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-red-400 hover:bg-red-400/5 rounded-lg text-[13px] transition-all"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {n('logout')}
        </button>
      </div>
    </aside>
  );
}
