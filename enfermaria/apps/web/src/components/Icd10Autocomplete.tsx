'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';

interface Icd10Result {
  code: string;
  descricao: string;
  confianca?: number;
}

interface Props {
  value: string;
  onChange: (code: string, descricao: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  notaClinica?: string; // optional: enables AI suggestion button
}

export default function Icd10Autocomplete({ value, onChange, placeholder = 'Ex: J18.9 ou pneumonia', className, style, notaClinica }: Props) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<Icd10Result[]>([]);
  const [aiResults, setAiResults] = useState<Icd10Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/codificacao/icd10', { params: { q: query, limit: 8 } });
        setResults(res.data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const select = (item: Icd10Result) => {
    setQuery(`${item.code} — ${item.descricao}`);
    setOpen(false);
    setShowAiPanel(false);
    onChange(item.code, item.descricao);
  };

  const handleAiSuggest = async () => {
    if (!notaClinica?.trim()) return;
    setLoadingAi(true);
    setShowAiPanel(true);
    try {
      const res = await api.post('/ai-clinico/icd10/sugerir', { nota: notaClinica });
      setAiResults(res.data ?? []);
    } catch {
      setAiResults([]);
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-owns="icd10-listbox"
        >
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); if (!e.target.value) onChange('', ''); }}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={placeholder}
            className={className}
            style={{ padding: '11px 16px', paddingRight: loading ? '40px' : '16px', width: '100%' }}
            autoComplete="off"
            aria-label="Código ICD-10"
            aria-autocomplete="list"
            aria-controls="icd10-listbox"
          />
          {loading && (
            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
              <svg className="animate-spin w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          {open && results.length > 0 && (
            <ul
              id="icd10-listbox"
              role="listbox"
              style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)', zIndex: 50, overflow: 'hidden',
              }}
            >
              {results.map(r => (
                <li
                  key={r.code}
                  role="option"
                  aria-selected={false}
                  onMouseDown={() => select(r)}
                  style={{
                    padding: '10px 16px', cursor: 'pointer', fontSize: '13px',
                    display: 'flex', gap: '8px', alignItems: 'baseline',
                  }}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <span style={{ fontWeight: 600, color: '#3b82f6', whiteSpace: 'nowrap' }}>{r.code}</span>
                  <span style={{ color: '#475569' }}>{r.descricao}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {notaClinica && (
          <button
            type="button"
            onClick={handleAiSuggest}
            disabled={loadingAi}
            title="Sugerir código ICD-10 com base na nota clínica"
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg disabled:opacity-50 transition-colors"
            style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}
          >
            {loadingAi ? (
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            )}
            Sugerir por IA
          </button>
        )}
      </div>

      {showAiPanel && (
        <div
          style={{
            marginTop: '8px', background: '#f0f0ff', border: '1px solid #c7d2fe',
            borderRadius: '12px', padding: '12px 14px',
          }}
        >
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Sugestões IA
          </p>
          {loadingAi && (
            <p style={{ fontSize: '12px', color: '#6366f1' }}>A analisar nota clínica...</p>
          )}
          {!loadingAi && aiResults.length === 0 && (
            <p style={{ fontSize: '12px', color: '#64748b' }}>Sem sugestões disponíveis.</p>
          )}
          {!loadingAi && aiResults.map(r => (
            <button
              key={r.code}
              type="button"
              onMouseDown={() => select(r)}
              style={{
                display: 'flex', width: '100%', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '8px', background: 'white',
                border: '1px solid #c7d2fe', cursor: 'pointer', marginBottom: '6px',
                textAlign: 'left',
              }}
              className="hover:bg-indigo-50 transition-colors"
            >
              <span style={{ fontWeight: 700, color: '#4f46e5', fontSize: '13px', whiteSpace: 'nowrap' }}>{r.code}</span>
              <span style={{ color: '#334155', fontSize: '13px', flex: 1 }}>{r.descricao}</span>
              {r.confianca != null && (
                <span style={{
                  fontSize: '11px', fontWeight: 600, color: '#6366f1',
                  background: '#e0e7ff', borderRadius: '6px', padding: '2px 7px', whiteSpace: 'nowrap',
                }}>
                  {Math.round(r.confianca * 100)}%
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowAiPanel(false)}
            style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
