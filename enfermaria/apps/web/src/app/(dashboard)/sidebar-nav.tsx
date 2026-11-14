'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Avatar, navItems, roleLabel, subRoleLabel, servicoLabel, roleColor, ORDEM_POR_PAPEL } from './nav-data';

/** UX-09: quantos itens por grupo ficam à vista; os restantes vão para "Mais". */
const VISIVEIS_POR_GRUPO = 7;
const CHAVE_FAVORITOS = 'curasphere_favoritos';

function lerFavoritos(): string[] {
  try { return JSON.parse(localStorage.getItem(CHAVE_FAVORITOS) ?? '[]'); } catch { return []; }
}

/**
 * UX-09 — ordem FIXA por frequência de uso do papel (não alfabética: em EN a ordem mudava e
 * quebrava a memória muscular); o que não está na lista do papel segue a ordem de nav-data.
 */
function ordenar(items: typeof navItems, role: string) {
  const prioridade = ORDEM_POR_PAPEL[role] ?? [];
  const pos = (href: string) => { const i = prioridade.indexOf(href); return i < 0 ? prioridade.length : i; };
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => pos(a.item.href) - pos(b.item.href) || a.i - b.i)
    .map((x) => x.item);
}

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
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});
  useEffect(() => { setFavoritos(lerFavoritos()); }, []);
  const alternarFavorito = (href: string) => {
    setFavoritos((fs) => {
      const novo = fs.includes(href) ? fs.filter((f) => f !== href) : [...fs, href];
      try { localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(novo)); } catch { /* sem storage */ }
      return novo;
    });
  };

  const renderItem = (item: (typeof navItems)[number], chave: string) => {
    const active = pathname === item.href;
    const fav = favoritos.includes(item.href);
    return (
      <div key={chave} className="group/item relative" style={{ marginBottom: '8px' }}>
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          onClick={onCloseSidebar}
          title={label(item)}
          style={{ display: 'flex' }}
          className={`group items-center gap-3 px-3 py-3 md:max-lg:justify-center rounded-xl text-sm font-medium transition-all duration-150 ${
            active
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-slate-500 hover:bg-white/5 hover:text-white'
          }`}
        >
          <span className={`transition-colors ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
            {item.icon}
          </span>
          <span className="md:max-lg:sr-only">{label(item)}</span>
        </Link>
        <button
          type="button"
          onClick={() => alternarFavorito(item.href)}
          aria-label={fav ? `Retirar ${label(item)} dos favoritos` : `Fixar ${label(item)} nos favoritos`}
          aria-pressed={fav}
          className={`md:max-lg:hidden absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-opacity ${
            fav ? 'text-amber-400 opacity-100' : 'text-slate-500 opacity-0 group-hover/item:opacity-100 focus:opacity-100'
          }`}
        >
          {fav ? '★' : '☆'}
        </button>
      </div>
    );
  };
  return (
    <aside
      id="sidebar-nav"
      data-aberta={sidebarAberta ? 'true' : 'false'}
      aria-label={n('mainNav')}
      className={`w-64 md:w-20 lg:w-64 shrink-0 bg-[#0f172a] flex flex-col border-r border-white/5 fixed md:relative inset-y-0 left-0 z-40 transform transition-transform duration-200 ${
        sidebarAberta ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}
    >
      {/* Logo */}
      <div className="border-b border-white/5 flex items-center justify-center" style={{ paddingTop: '28px', paddingBottom: '24px' }}>
        <div className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="CuraSphere" width={36} height={36} />
          <div className="md:max-lg:hidden">
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
            <span className="flex-1 text-left text-slate-500 md:max-lg:sr-only">{n('search')}</span>
            <kbd className="hidden lg:flex items-center gap-0.5 text-[10px] text-slate-600 font-mono">
              <span>⌘</span><span>K</span>
            </kbd>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto" style={{ paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px' }}>
        {favoritos.length > 0 && (() => {
          const favs = itemsVisiveis.filter((it) => favoritos.includes(it.href));
          if (!favs.length) return null;
          return (
            <>
              <p className="text-slate-600 text-[10px] font-semibold uppercase tracking-widest md:max-lg:hidden" style={{ marginBottom: '8px', paddingLeft: '12px' }}>
                Favoritos
              </p>
              {favs.map((it) => renderItem(it, `fav-${it.href}`))}
              <div className="border-b border-white/5" style={{ margin: '12px 0 16px' }} />
            </>
          );
        })()}
        {(['A', 'B', 'C', 'D'] as const).reduce<React.ReactNode[]>((acc, grupo) => {
          const GRUPO_LABELS: Record<string, string> = { A: n('groupDashboards'), B: n('groupWork'), C: n('groupPersonal'), D: n('groupComms') };
          const items = ordenar(itemsVisiveis.filter(i => i.grupo === grupo && !favoritos.includes(i.href)), utilizador.role);
          if (items.length === 0) return acc;
          acc.push(
            <p
              key={`label-${grupo}`}
              className="text-slate-600 text-[10px] font-semibold uppercase tracking-widest md:max-lg:hidden"
              style={{ marginBottom: '8px', paddingLeft: '12px', marginTop: acc.length > 0 ? '20px' : '0' }}
            >
              {GRUPO_LABELS[grupo]}
            </p>
          );
          const visiveis = items.slice(0, VISIVEIS_POR_GRUPO);
          const mais = items.slice(VISIVEIS_POR_GRUPO);
          // O grupo abre sozinho se a página actual estiver no "Mais".
          const aberto = gruposAbertos[grupo] ?? mais.some((it) => it.href === pathname);
          visiveis.forEach((item) => acc.push(renderItem(item, item.href)));
          if (mais.length) {
            acc.push(
              <button
                key={`mais-${grupo}`}
                type="button"
                onClick={() => setGruposAbertos((g) => ({ ...g, [grupo]: !aberto }))}
                aria-expanded={aberto}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-white hover:bg-white/5 md:max-lg:justify-center"
                style={{ marginBottom: '8px' }}
                title={aberto ? 'Menos' : `Mais (${mais.length})`}
              >
                <span aria-hidden="true">{aberto ? '▴' : '▾'}</span>
                <span className="md:max-lg:sr-only">{aberto ? 'Menos' : `Mais (${mais.length})`}</span>
              </button>,
            );
            if (aberto) mais.forEach((item) => acc.push(renderItem(item, item.href)));
          }
          return acc;
        }, [])}
      </nav>

      {/* Perfil */}
      <div className="border-t border-white/5" style={{ padding: '12px 16px' }}>
        <div className="rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.06)', padding: '12px 14px', marginBottom: '6px' }}>
          <div className="flex items-center gap-3">
            <Avatar nome={utilizador.nome} />
            <div className="flex-1 min-w-0 md:max-lg:hidden">
              <p className="text-white text-[13px] font-semibold truncate leading-snug">{utilizador.nome}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`shrink-0 text-[10px] font-semibold badge-pad py-0.5 rounded-full ${roleColor[utilizador.role] ?? 'bg-slate-500/15 text-slate-500'}`}>
                  {roleLabel[utilizador.role] ?? utilizador.role}
                </span>
                {utilizador.subRole && (
                  <span className="text-[10px] text-slate-500 truncate">
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
          <span className="md:max-lg:sr-only">{n('notifications')}</span> {naoLidas > 0 && <span className="ml-auto text-[10px] font-bold text-red-500 md:max-lg:hidden">{naoLidas}</span>}
        </Link>

        <Link
          href="/perfil"
          onClick={onCloseSidebar}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/5 rounded-lg text-[13px] transition-all"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="md:max-lg:sr-only">{n('profile')}</span>
        </Link>

        <button
          onClick={onOpenConfig}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/5 rounded-lg text-[13px] transition-all"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="md:max-lg:sr-only">{n('settings')}</span>
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 hover:text-red-400 hover:bg-red-400/5 rounded-lg text-[13px] transition-all"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="md:max-lg:sr-only">{n('logout')}</span>
        </button>
      </div>
    </aside>
  );
}
