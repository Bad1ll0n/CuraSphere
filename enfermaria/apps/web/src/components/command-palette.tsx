'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Command } from 'cmdk';
import api from '@/lib/api';
import {
  acoesDaFicha, corresponde, doenteDoCaminho, entradasDoMenu, lerRecentes, registarRecente,
  type DoenteRecente, type EntradaPaleta,
} from '@/lib/paleta-comandos';

interface Doente {
  id: string;
  nome: string;
  numeroProcesso: string;
  cama?: { numero: string; quarto?: { nome: string } } | null;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** UX-18: o menu já filtrado pelo papel (`filtrarMenus`) — antes eram listas fixas. */
  itens: { href: string; label: string }[];
  utilizadorId: string;
  /** Só quem vê `/doentes` pesquisa doentes (os outros recebiam 403 a cada tecla). */
  podePesquisarDoentes: boolean;
  podeAdmitir: boolean;
}

const ITEM = 'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm text-slate-700 dark:text-slate-200 aria-selected:bg-indigo-50 dark:aria-selected:bg-indigo-900/30 aria-selected:text-indigo-700 dark:aria-selected:text-indigo-300';

function Inicial({ nome, violeta }: { nome: string; violeta?: boolean }) {
  return (
    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${violeta ? 'bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
      {nome.charAt(0)}
    </span>
  );
}

export function CommandPalette({ open, onClose, itens, utilizadorId, podePesquisarDoentes, podeAdmitir }: CommandPaletteProps) {
  const t = useTranslations('palette');
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [doentes, setDoentes] = useState<Doente[]>([]);
  const [recentes, setRecentes] = useState<DoenteRecente[]>([]);
  const [loading, setLoading] = useState(false);
  const [nlqResultados, setNlqResultados] = useState<Doente[]>([]);
  const [nlqExplicacao, setNlqExplicacao] = useState<string | null>(null);
  const [nlqLoading, setNlqLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nlqDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isNLQ = query.startsWith('?');
  const nlqQuery = query.slice(1).trim();
  const doenteAberto = doenteDoCaminho(pathname);

  const navegacao = useMemo(() => entradasDoMenu(itens), [itens]);
  const acoesGerais = useMemo<EntradaPaleta[]>(() => [
    ...(podeAdmitir ? [{ id: 'acao:admitir', label: t('admit'), href: '/doentes/admitir', palavras: ['novo doente', 'admissão', 'internar'] }] : []),
    ...(podePesquisarDoentes ? [{ id: 'acao:doentes', label: t('patientList'), href: '/doentes', palavras: ['doentes', 'lista'] }] : []),
  ], [podeAdmitir, podePesquisarDoentes, t]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDoentes([]);
      setNlqResultados([]);
      setNlqExplicacao(null);
    } else {
      setRecentes(lerRecentes(utilizadorId));
    }
  }, [open, utilizadorId]);

  // Escape ao nível do documento: o `onKeyDown` do <Command> só apanha teclas quando o foco
  // já está dentro da paleta. Quem clique no fundo escuro perde o foco e ficava preso.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Devolve o foco ao elemento que abriu a paleta (WCAG 2.4.3).
  useEffect(() => {
    if (!open) return;
    const gatilho = document.activeElement as HTMLElement | null;
    return () => { gatilho?.focus?.(); };
  }, [open]);

  useEffect(() => {
    if (isNLQ || !podePesquisarDoentes) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) { setDoentes([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/doentes', { params: { search: query, limit: 8, todos: 'true' } });
        setDoentes(data?.data ?? data ?? []);
      } catch { setDoentes([]); }
      finally { setLoading(false); }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, isNLQ, podePesquisarDoentes]);

  useEffect(() => {
    if (!isNLQ) { setNlqResultados((r) => (r.length ? [] : r)); setNlqExplicacao(null); return; }
    if (nlqDebounceRef.current) clearTimeout(nlqDebounceRef.current);
    if (nlqQuery.length < 3) { setNlqResultados([]); setNlqExplicacao(null); return; }

    nlqDebounceRef.current = setTimeout(async () => {
      setNlqLoading(true);
      try {
        const { data } = await api.post('/ai-clinico/nlq', { query: nlqQuery });
        setNlqResultados(data?.resultados ?? []);
        setNlqExplicacao(data?.explicacao ?? null);
      } catch { setNlqResultados([]); setNlqExplicacao(t('aiError')); }
      finally { setNlqLoading(false); }
    }, 600);

    return () => { if (nlqDebounceRef.current) clearTimeout(nlqDebounceRef.current); };
  }, [isNLQ, nlqQuery]);

  const navegar = useCallback((href: string) => {
    const [caminho, hash] = href.split('#');
    // Na própria ficha só muda o separador: o `hashchange` chega à página (o router não o emite).
    if (hash && caminho === pathname) window.location.hash = hash;
    else router.push(href);
    onClose();
  }, [router, onClose, pathname]);

  const abrirDoente = useCallback((d: Doente | DoenteRecente) => {
    const cama = 'cama' in d && d.cama && typeof d.cama === 'object' ? d.cama.numero : (d as DoenteRecente).cama ?? null;
    registarRecente(utilizadorId, { id: d.id, nome: d.nome, cama });
    navegar(`/doentes/${d.id}`);
  }, [navegar, utilizadorId]);

  if (!open) return null;

  const isSearching = isNLQ ? nlqLoading : loading;
  const nav = navegacao.filter((e) => corresponde(e, query));
  const acoes = acoesGerais.filter((e) => corresponde(e, query));
  const daFicha = doenteAberto ? acoesDaFicha(doenteAberto).filter((e) => corresponde(e, query)) : [];
  const recentesVisiveis = recentes.filter((d) => d.id !== doenteAberto && corresponde({ label: d.nome }, query));

  const grupoEntradas = (heading: string, entradas: EntradaPaleta[]) => entradas.length > 0 && (
    <Command.Group heading={heading} className="mb-2">
      {entradas.map((e) => (
        <Command.Item key={e.id} value={e.id} onSelect={() => navegar(e.href)} className={ITEM}>
          <span className="flex-1">{e.label}</span>
          {e.tecla && <kbd className="font-mono text-xs text-slate-500 border border-slate-200 dark:border-slate-700 rounded" style={{ padding: '0 6px' }}>{e.tecla}</kbd>}
        </Command.Item>
      ))}
    </Command.Group>
  );

  return (
    <div role="presentation"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
      >
        <Command
          className="flex flex-col"
          shouldFilter={false}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        >
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 px-4">
            {isNLQ ? (
              <span className="text-sm shrink-0" title={t('aiMode')}>🧠</span>
            ) : (
              <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            <Command.Input
              autoFocus
              placeholder={t('placeholder')}
              value={query}
              onValueChange={setQuery}
              className="flex-1 py-4 text-sm bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
            {isNLQ && (
              <span className="shrink-0 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg" style={{ padding: '2px 8px' }}>
                {t('aiMode')}
              </span>
            )}
            <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
              Esc
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-slate-500">
              {isSearching ? t('searching') : t('empty')}
            </Command.Empty>

            {isNLQ && nlqResultados.length > 0 && (
              <Command.Group heading={`🧠 ${nlqExplicacao ?? t('aiResults')}`} className="mb-2">
                {nlqResultados.map((d) => (
                  <Command.Item key={d.id} value={d.id} onSelect={() => abrirDoente(d)}
                    className={ITEM.replace(/indigo/g, 'violet')}>
                    <Inicial nome={d.nome} violeta />
                    <span className="flex-1 font-medium truncate">{d.nome}</span>
                    <span className="text-xs text-slate-500 shrink-0">{d.cama ? t('bed', { numero: d.cama.numero }) : d.numeroProcesso}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {!isNLQ && (
              <>
                {grupoEntradas(t('thisRecord'), daFicha)}

                {doentes.length > 0 && (
                  <Command.Group heading={t('patients')} className="mb-2">
                    {doentes.map((d) => (
                      <Command.Item key={d.id} value={d.id} onSelect={() => abrirDoente(d)} className={ITEM}>
                        <Inicial nome={d.nome} />
                        <span className="flex-1 font-medium truncate">{d.nome}</span>
                        <span className="text-xs text-slate-500 shrink-0">{d.cama ? t('bed', { numero: d.cama.numero }) : d.numeroProcesso}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {recentesVisiveis.length > 0 && (
                  <Command.Group heading={t('recent')} className="mb-2">
                    {recentesVisiveis.map((d) => (
                      <Command.Item key={`recente:${d.id}`} value={`recente:${d.id}`} onSelect={() => abrirDoente(d)} className={ITEM}>
                        <Inicial nome={d.nome} />
                        <span className="flex-1 font-medium truncate">{d.nome}</span>
                        {d.cama && <span className="text-xs text-slate-500 shrink-0">{t('bed', { numero: d.cama })}</span>}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {grupoEntradas(t('actions'), acoes)}
                {grupoEntradas(t('navigation'), nav)}
              </>
            )}
          </Command.List>

          <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2 flex items-center gap-4 text-xs text-slate-500">
            <span><kbd className="font-mono">↑↓</kbd> {t('hintNavigate')}</span>
            <span><kbd className="font-mono">Enter</kbd> {t('hintOpen')}</span>
            <span><kbd className="font-mono">Esc</kbd> {t('hintClose')}</span>
            <span className="ml-auto">🧠 <kbd className="font-mono">?</kbd> {t('hintAi')}</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
