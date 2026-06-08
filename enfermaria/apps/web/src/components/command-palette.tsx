'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import api from '@/lib/api';

interface Doente {
  id: string;
  nome: string;
  numeroProcesso: string;
  cama?: { numero: string; quarto?: { nome: string } } | null;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const NAV_LINKS = [
  { label: 'Camas', href: '/camas', icon: '🛏️' },
  { label: 'Urgência', href: '/urgencia', icon: '🚨' },
  { label: 'Farmácia', href: '/farmacia', icon: '💊' },
  { label: 'Horários', href: '/horarios', icon: '📅' },
  { label: 'Audit Log', href: '/audit', icon: '🔍' },
  { label: 'Relatórios', href: '/relatorios', icon: '📊' },
  { label: 'Portal Doente', href: '/portal', icon: '👤' },
];

const ACOES = [
  { label: 'Novo doente', href: '/doentes/novo', icon: '➕' },
  { label: 'Lista de doentes', href: '/doentes', icon: '📋' },
  { label: 'Dashboard', href: '/dashboard', icon: '🏥' },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [doentes, setDoentes] = useState<Doente[]>([]);
  const [loading, setLoading] = useState(false);
  const [nlqResultados, setNlqResultados] = useState<Doente[]>([]);
  const [nlqExplicacao, setNlqExplicacao] = useState<string | null>(null);
  const [nlqLoading, setNlqLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nlqDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isNLQ = query.startsWith('?');
  const nlqQuery = query.slice(1).trim();

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDoentes([]);
      setNlqResultados([]);
      setNlqExplicacao(null);
    }
  }, [open]);

  useEffect(() => {
    if (isNLQ) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) { setDoentes([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/doentes', { params: { search: query, take: 8 } });
        setDoentes(data?.data ?? data ?? []);
      } catch { setDoentes([]); }
      finally { setLoading(false); }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, isNLQ]);

  useEffect(() => {
    if (!isNLQ) { setNlqResultados([]); setNlqExplicacao(null); return; }
    if (nlqDebounceRef.current) clearTimeout(nlqDebounceRef.current);
    if (nlqQuery.length < 3) { setNlqResultados([]); setNlqExplicacao(null); return; }

    nlqDebounceRef.current = setTimeout(async () => {
      setNlqLoading(true);
      try {
        const { data } = await api.post('/ai-clinico/nlq', { query: nlqQuery });
        setNlqResultados(data?.resultados ?? []);
        setNlqExplicacao(data?.explicacao ?? null);
      } catch { setNlqResultados([]); setNlqExplicacao('Erro na pesquisa IA'); }
      finally { setNlqLoading(false); }
    }, 600);

    return () => { if (nlqDebounceRef.current) clearTimeout(nlqDebounceRef.current); };
  }, [isNLQ, nlqQuery]);

  const navegar = useCallback((href: string) => {
    router.push(href);
    onClose();
  }, [router, onClose]);

  if (!open) return null;

  const isSearching = isNLQ ? nlqLoading : loading;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          className="flex flex-col"
          shouldFilter={false}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        >
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 px-4">
            {isNLQ ? (
              <span className="text-sm shrink-0" title="Modo pesquisa IA">🧠</span>
            ) : (
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            <Command.Input
              autoFocus
              placeholder="Pesquisar doentes, navegar... ou ? + pergunta para IA"
              value={query}
              onValueChange={setQuery}
              className="flex-1 py-4 text-sm bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
            {isNLQ && (
              <span className="shrink-0 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg" style={{ padding: '2px 8px' }}>
                Modo IA
              </span>
            )}
            <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
              Esc
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-slate-400">
              {isSearching ? 'A pesquisar...' : 'Sem resultados.'}
            </Command.Empty>

            {isNLQ && nlqResultados.length > 0 && (
              <Command.Group heading={`🧠 IA: ${nlqExplicacao ?? 'Resultados'}`} className="mb-2">
                {nlqResultados.map((d) => (
                  <Command.Item
                    key={d.id}
                    value={d.id}
                    onSelect={() => navegar(`/doentes/${d.id}`)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm text-slate-700 dark:text-slate-200 aria-selected:bg-violet-50 dark:aria-selected:bg-violet-900/30 aria-selected:text-violet-700 dark:aria-selected:text-violet-300"
                  >
                    <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-xs font-semibold text-violet-600 dark:text-violet-400 shrink-0">
                      {d.nome.charAt(0)}
                    </span>
                    <span className="flex-1 font-medium truncate">{d.nome}</span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {d.cama ? `Cama ${d.cama.numero}` : d.numeroProcesso}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {!isNLQ && doentes.length > 0 && (
              <Command.Group heading="Doentes" className="mb-2">
                {doentes.map((d) => (
                  <Command.Item
                    key={d.id}
                    value={d.id}
                    onSelect={() => navegar(`/doentes/${d.id}`)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm text-slate-700 dark:text-slate-200 aria-selected:bg-indigo-50 dark:aria-selected:bg-indigo-900/30 aria-selected:text-indigo-700 dark:aria-selected:text-indigo-300"
                  >
                    <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                      {d.nome.charAt(0)}
                    </span>
                    <span className="flex-1 font-medium truncate">{d.nome}</span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {d.cama ? `Cama ${d.cama.numero}` : d.numeroProcesso}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {!isNLQ && (
              <>
                <Command.Group heading="Navegação rápida" className="mb-2">
                  {NAV_LINKS.filter(n =>
                    !query || n.label.toLowerCase().includes(query.toLowerCase())
                  ).map((n) => (
                    <Command.Item
                      key={n.href}
                      value={n.label}
                      onSelect={() => navegar(n.href)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm text-slate-700 dark:text-slate-200 aria-selected:bg-indigo-50 dark:aria-selected:bg-indigo-900/30 aria-selected:text-indigo-700 dark:aria-selected:text-indigo-300"
                    >
                      <span className="w-6 text-center">{n.icon}</span>
                      <span>{n.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group heading="Ações">
                  {ACOES.filter(a =>
                    !query || a.label.toLowerCase().includes(query.toLowerCase())
                  ).map((a) => (
                    <Command.Item
                      key={a.href}
                      value={a.label}
                      onSelect={() => navegar(a.href)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm text-slate-700 dark:text-slate-200 aria-selected:bg-indigo-50 dark:aria-selected:bg-indigo-900/30 aria-selected:text-indigo-700 dark:aria-selected:text-indigo-300"
                    >
                      <span className="w-6 text-center">{a.icon}</span>
                      <span>{a.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </>
            )}
          </Command.List>

          <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2 flex items-center gap-4 text-xs text-slate-400">
            <span><kbd className="font-mono">↑↓</kbd> navegar</span>
            <span><kbd className="font-mono">Enter</kbd> abrir</span>
            <span><kbd className="font-mono">Esc</kbd> fechar</span>
            <span className="ml-auto">🧠 <kbd className="font-mono">?</kbd> + texto para pesquisa IA</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
