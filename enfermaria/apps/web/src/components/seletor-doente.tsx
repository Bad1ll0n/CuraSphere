'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';

export interface DoenteOpcao {
  id: string;
  nome: string;
  numeroProcesso?: string;
  cama?: { quarto?: string; numero?: string; servico?: string } | null;
  atribuido?: boolean;
}

const LIMITE = 20;

/**
 * PERF-05 — escolher um doente pesquisando no servidor.
 *
 * As listas de seleção pediam `/doentes?todos=true` e mostravam o que viesse (25 doentes; 200 na
 * faturação), filtrando no browser — num hospital com mais internados, o doente simplesmente não
 * aparecia. Aqui cada pesquisa (nome, n.º de processo; o diagnóstico para quem o pode ver) vai ao
 * servidor, com debounce, e mostra-se quantos há quando passam do limite.
 *
 * `soComAcesso` esconde os doentes que o clínico encontra mas a que não está atribuído
 * (`atribuido: false`) — para formulários que registam no processo do doente.
 */
export function SeletorDoente({
  id, value, onChange, opcional, soComAcesso, autoFocus, className,
}: {
  id?: string;
  value: string;
  onChange: (id: string, doente: DoenteOpcao | null) => void;
  /** Texto da opção "nenhum doente" — se existir, o campo pode ficar vazio. */
  opcional?: string;
  soComAcesso?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const t = useTranslations('patientPicker');
  const idBase = useId();
  const inputId = id ?? `${idBase}-input`;
  const listaId = `${idBase}-lista`;
  const [termo, setTermo] = useState('');
  const [termoPedido, setTermoPedido] = useState('');
  const [aberto, setAberto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [escolhido, setEscolhido] = useState<DoenteOpcao | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tm = setTimeout(() => setTermoPedido(termo.trim()), 300);
    return () => clearTimeout(tm);
  }, [termo]);

  // Quem está fora limpou o valor (ex.: formulário reposto) — o campo também.
  useEffect(() => {
    if (!value && escolhido) { setEscolhido(null); setTermo(''); }
  }, [value, escolhido]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['seletor-doente', termoPedido],
    queryFn: () => api.get('/doentes', { params: { todos: 'true', limit: LIMITE, ...(termoPedido ? { search: termoPedido } : {}) } }).then((r) => r.data),
    enabled: aberto,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  const todos: DoenteOpcao[] = data?.data ?? (Array.isArray(data) ? data : []);
  const opcoes = soComAcesso ? todos.filter((d) => d.atribuido !== false) : todos;
  const total: number = data?.total ?? opcoes.length;

  const escolher = (d: DoenteOpcao | null) => {
    setEscolhido(d);
    setTermo(d ? d.nome : '');
    setAberto(false);
    onChange(d?.id ?? '', d);
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); setActivo((i) => Math.min(i + 1, opcoes.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && aberto && opcoes[activo]) { e.preventDefault(); escolher(opcoes[activo]); }
    else if (e.key === 'Escape' && aberto) { e.stopPropagation(); setAberto(false); }
  };

  return (
    <div ref={caixa} className="relative"
      onBlur={(e) => { if (!caixa.current?.contains(e.relatedTarget as Node)) setAberto(false); }}>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={aberto && opcoes[activo] ? `${listaId}-${opcoes[activo].id}` : undefined}
        autoComplete="off"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        placeholder={t('placeholder')}
        value={termo}
        onFocus={() => setAberto(true)}
        onChange={(e) => {
          setTermo(e.target.value); setAberto(true); setActivo(0);
          if (escolhido) { setEscolhido(null); onChange('', null); }
        }}
        onKeyDown={teclas}
        className={className ?? 'w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500'}
        style={{ padding: '10px 14px' }}
      />
      {aberto && (
        <ul id={listaId} role="listbox" aria-label={t('results')}
          className="absolute z-20 left-0 right-0 border border-slate-200 rounded-xl bg-white shadow-lg"
          style={{ maxHeight: '240px', overflowY: 'auto', marginTop: '4px' }}>
          {opcional && (
            <li role="option" aria-selected={!value} tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(null)}
              onKeyDown={(e) => { if (e.key === 'Enter') escolher(null); }}
              className="text-sm text-slate-500 hover:bg-slate-50 cursor-pointer" style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
              {opcional}
            </li>
          )}
          {opcoes.map((d, i) => (
            <li key={d.id} id={`${listaId}-${d.id}`} role="option" aria-selected={d.id === value} tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(d)}
              onKeyDown={(e) => { if (e.key === 'Enter') escolher(d); }}
              className={`text-sm cursor-pointer ${i === activo ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
              <span className="font-medium text-slate-800">{d.nome}</span>
              {d.numeroProcesso && <span className="text-slate-500 text-xs" style={{ marginLeft: '8px' }}>{d.numeroProcesso}</span>}
              {d.cama && <span className="text-slate-500 text-xs" style={{ marginLeft: '8px' }}>{t('bed', { quarto: d.cama.quarto ?? '—', numero: d.cama.numero ?? '—' })}</span>}
            </li>
          ))}
          {isError && <li className="text-sm text-red-600" style={{ padding: '10px 14px' }}>{t('error')}</li>}
          {!isError && !isFetching && opcoes.length === 0 && (
            <li className="text-sm text-slate-500" style={{ padding: '10px 14px' }}>{termoPedido ? t('noResults') : t('typeToSearch')}</li>
          )}
          {isFetching && <li className="text-xs text-slate-400" style={{ padding: '8px 14px' }}>{t('searching')}</li>}
          {!isFetching && total > todos.length && (
            <li className="text-xs text-slate-500" style={{ padding: '8px 14px' }}>{t('more', { n: todos.length, total })}</li>
          )}
        </ul>
      )}
    </div>
  );
}
