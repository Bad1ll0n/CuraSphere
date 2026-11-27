'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { SkeletonTable } from '@/components/skeleton';
import { ErroCarregamento } from '@/components/erro-carregamento';
import { Button } from '@/components/ui';
import { ROLES_CLINICOS, caminhoListaDoentes, chaveListaDoentes } from './lista';

const SERVICOS_LISTA = ['Cardiologia', 'Ortopedia', 'Medicina Interna', 'Cirurgia', 'Neurologia', 'UCI'];

interface Doente {
  id: string;
  nome: string;
  numeroProcesso: string;
  estado: string;
  diagnosticoPrincipal: string;
  dataAdmissao: string;
  dataAltaPrevista?: string;
  cama: { numero: string; quarto: string; servico?: string };
}

const estadoCor: Record<string, { badge: string; dot: string }> = {
  estavel:      { badge: 'bg-green-50 text-green-700 border border-green-200',   dot: 'bg-green-500' },
  grave:        { badge: 'bg-orange-50 text-orange-700 border border-orange-200', dot: 'bg-orange-500' },
  critico:      { badge: 'bg-red-50 text-red-700 border border-red-200',          dot: 'bg-red-500' },
  alta_prevista:{ badge: 'bg-blue-50 text-blue-700 border border-blue-200',       dot: 'bg-blue-500' },
};

const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};


const BANDA_CORES: Record<string, string> = {
  verde: 'bg-green-100 text-green-700 border-green-200',
  ambar: 'bg-amber-100 text-amber-700 border-amber-200',
  vermelho: 'bg-red-100 text-red-700 border-red-200',
};

export function DoentesCliente() {
  const tp = useTranslations('patients');
  const ts = useTranslations('patientStatus');
  const { utilizador } = useAuth();
  const [pesquisa, setPesquisa] = useState('');
  const [pesquisaDebounced, setPesquisaDebounced] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroServico, setFiltroServico] = useState('');
  const [pagina, setPagina] = useState(1);
  const [aba, setAba] = useState<'meus' | 'todos' | 'risco'>('meus');
  const [riscoServico, setRiscoServico] = useState(SERVICOS_LISTA[0]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isClinico = ROLES_CLINICOS.includes(utilizador?.role ?? '');
  const podeAdmitir = ['administrativo', 'enfermeiro', 'medico'].includes(utilizador?.role ?? '');

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPesquisaDebounced(pesquisa);
      setPagina(1);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [pesquisa]);

  const todos = !isClinico || aba === 'todos';
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: chaveListaDoentes(pagina, todos, pesquisaDebounced),
    queryFn: () => api.get(caminhoListaDoentes(pagina, todos, pesquisaDebounced)).then(r => r.data),
    enabled: aba !== 'risco',
    placeholderData: (prev) => prev,
  });

  const { data: riscoData, isLoading: riscoLoading, isError: riscoErro, refetch: refetchRisco } = useQuery({
    queryKey: ['risco-turno', riscoServico],
    queryFn: () => api.get('/baselines/risco-turno', { params: { servico: riscoServico } }).then(r => r.data),
    enabled: aba === 'risco',
    refetchInterval: 120_000,
  });

  const doentes: Doente[] = data?.data ?? data ?? [];
  const total: number = data?.total ?? doentes.length;
  const totalPaginas: number = data?.totalPaginas ?? 1;

  const mudarAba = (novaAba: 'meus' | 'todos' | 'risco') => { setAba(novaAba); setPagina(1); };

  // Filtros client-side residuais (estado + serviço, não há query params para estes)
  const filtrados = doentes.filter((d) => {
    const matchEstado = !filtroEstado || d.estado === filtroEstado;
    const matchServico = !filtroServico || d.cama?.servico === filtroServico;
    return matchEstado && matchServico;
  });

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{tp('title')}</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>
            {tp('count', { n: total })}
          </p>
        </div>
        {podeAdmitir && (
          <Link
            href="/doentes/admitir"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
            style={{ padding: '11px 22px', fontSize: '14px' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {tp('admit')}
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

        {/* Tabs — só para clínicos */}
        {isClinico && (
          <div className="flex border-b border-slate-100" style={{ padding: '0 24px' }}>
            {(['meus', 'todos', 'risco'] as const).map((t) => (
              <button
                key={t}
                onClick={() => mudarAba(t)}
                className={`text-sm font-medium transition-colors relative ${
                  aba === t ? (t === 'risco' ? 'text-amber-600' : 'text-blue-600') : 'text-slate-500 hover:text-slate-700'
                }`}
                style={{ padding: '14px 0', marginRight: '24px' }}
              >
                {tp(`tab.${t}`)}
                {aba === t && (
                  <span className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${t === 'risco' ? 'bg-amber-500' : 'bg-blue-600'}`} />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100" style={{ padding: '12px 24px' }}>
          <label htmlFor="filtro-estado" className="sr-only">{tp('filterByStatus')}</label>
          <select id="filtro-estado" value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPagina(1); }}
            className="text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ padding: '7px 12px' }}>
            <option value="">{tp('allStatuses')}</option>
            <option value="estavel">{ts('estavel')}</option>
            <option value="grave">{ts('grave')}</option>
            <option value="critico">{ts('critico')}</option>
          </select>
          <label htmlFor="filtro-servico" className="sr-only">{tp('filterByService')}</label>
          <select id="filtro-servico" value={filtroServico} onChange={e => { setFiltroServico(e.target.value); setPagina(1); }}
            className="text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ padding: '7px 12px' }}>
            <option value="">{tp('allServices')}</option>
            {(['internamento', 'urgencia', 'uci', 'bloco_operatorio'] as const).map((s) => <option key={s} value={s}>{tp(`service.${s}`)}</option>)}
          </select>
          {(filtroEstado || filtroServico) && (
            <button onClick={() => { setFiltroEstado(''); setFiltroServico(''); }} className="text-xs text-slate-500 hover:text-slate-600">{tp('clearFilters')}</button>
          )}
        </div>

        {/* Barra de pesquisa */}
        <div className="flex items-center gap-3 border-b border-slate-100" style={{ padding: '16px 24px' }}>
          <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={tp('searchPlaceholder')}
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            className="flex-1 text-sm text-slate-700 placeholder-slate-400 bg-transparent focus:outline-none"
          />
          {pesquisa && (
            <button onClick={() => setPesquisa('')} aria-label={tp('clearSearch')} className="text-slate-500 hover:text-slate-600 transition-colors">
              <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Vista de Risco */}
        {aba === 'risco' && (
          <div>
            <div className="flex items-center gap-3 border-b border-slate-100" style={{ padding: '12px 24px' }}>
              <select value={riscoServico} onChange={e => setRiscoServico(e.target.value)}
                className="text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none"
                style={{ padding: '7px 12px' }}>
                {SERVICOS_LISTA.map(s => <option key={s}>{s}</option>)}
              </select>
              <span className="text-xs text-slate-500">{tp('autoRefresh')}</span>
            </div>
            {riscoLoading ? (
              <div className="flex items-center justify-center gap-2 text-slate-500" style={{ padding: '48px' }}>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">{tp('computingRisk')}</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '12px 24px' }}>{tp('col.bed')}</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '12px 16px' }}>{tp('col.patient')}</th>
                      <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '12px 16px' }}>{tp('col.risk')}</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '12px 16px' }}>{tp('col.factors')}</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '12px 16px' }}>{tp('col.lastVitals')}</th>
                      <th style={{ padding: '12px 24px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(riscoData ?? []).map((r: any, i: number) => (
                      <tr key={r.doenteId} className="hover:bg-slate-50 transition-colors" style={{ borderTop: i > 0 ? '1px solid #f8fafc' : undefined }}>
                        <td style={{ padding: '14px 24px' }}>
                          <span className="font-mono text-sm font-semibold text-slate-700">{r.cama}</span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className="font-semibold text-slate-800">{r.nome}</span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span className={`inline-flex items-center gap-1 text-xs font-bold rounded-lg border ${BANDA_CORES[r.banda]}`} style={{ padding: '4px 12px' }}>
                            {r.score}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', maxWidth: '280px' }}>
                          <div className="flex flex-wrap gap-1">
                            {r.factores.map((f: string) => (
                              <span key={f} className="text-xs bg-slate-100 text-slate-600 rounded-md" style={{ padding: '2px 8px' }}>{f}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className="text-xs text-slate-500">
                            {r.ultimoSV ? new Date(r.ultimoSV).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 24px' }}>
                          <Link href={`/doentes/${r.doenteId}`}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1">
                            {tp('view')}
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {riscoErro ? (
                      <tr><td colSpan={6}>
                        <ErroCarregamento
                          titulo={tp('riskLoadErrorTitle')}
                          descricao={tp('riskLoadErrorBody')}
                          onTentarNovamente={() => refetchRisco()}
                        />
                      </td></tr>
                    ) : (riscoData ?? []).length === 0 && (
                      <tr><td colSpan={6} className="text-center text-slate-500 text-sm" style={{ padding: '48px' }}>{tp('noActive')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {aba !== 'risco' && (isLoading ? (
          <SkeletonTable rows={8} />
        ) : isError ? (
          <ErroCarregamento
            titulo={tp('loadErrorTitle')}
            descricao={tp('loadErrorBody')}
            onTentarNovamente={() => refetch()}
          />
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center" style={{ padding: '64px' }}>
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center" style={{ marginBottom: '16px' }}>
              <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium text-sm" style={{ marginBottom: '4px' }}>
              {pesquisa
                ? tp('noneFound')
                : aba === 'meus'
                  ? tp('noneAssigned')
                  : tp('noneAdmitted')}
            </p>
            <p className="text-slate-500 text-xs">
              {pesquisa
                ? tp('tryOther')
                : aba === 'meus'
                  ? tp('noneAssignedHint')
                  : tp('noneAdmittedHint')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th scope="col" className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '13px 24px 13px 36px' }}>{tp('col.patient')}</th>
                  <th scope="col" className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '13px 16px' }}>{tp('col.record')}</th>
                  <th scope="col" className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '13px 16px' }}>{tp('col.bed')}</th>
                  <th scope="col" className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '13px 16px' }}>{tp('col.diagnosis')}</th>
                  <th scope="col" className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '13px 16px' }}>{tp('col.status')}</th>
                  <th scope="col" className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '13px 16px' }}>{tp('col.admission')}</th>
                  <th scope="col" className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '13px 16px' }}>{tp('col.expectedDischarge')}</th>
                  <th scope="col" style={{ padding: '13px 24px' }}><span className="sr-only">{tp('col.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d, i) => (
                  <tr key={d.id}
                    className="hover:bg-slate-50 transition-colors"
                    style={{ borderTop: i > 0 ? '1px solid #f8fafc' : undefined }}>
                    <td style={{ padding: '16px 24px 16px 36px' }}>
                      <span className="font-semibold text-slate-800">{d.nome}</span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className="text-slate-500 font-mono text-xs">{d.numeroProcesso}</span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className="text-slate-600 font-medium">
                        {d.cama ? `Quarto ${d.cama.quarto} · Cama ${d.cama.numero}` : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '16px', maxWidth: '200px' }}>
                      <span className="text-slate-500 truncate block">{d.diagnosticoPrincipal}</span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg ${estadoCor[d.estado]?.badge ?? 'bg-slate-100 text-slate-500'}`} style={{ padding: '5px 10px' }}>
                        <span className={`w-1.5 h-1.5 rounded-full ${estadoCor[d.estado]?.dot ?? 'bg-slate-400'}`} />
                        {d.estado in estadoLabel ? ts(d.estado) : d.estado}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className="text-slate-500 text-xs">{new Date(d.dataAdmissao).toLocaleDateString('pt-PT')}</span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className="text-slate-500 text-xs">
                        {d.dataAltaPrevista ? new Date(d.dataAltaPrevista).toLocaleDateString('pt-PT') : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <Link href={`/doentes/${d.id}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1">
                        Ver
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Paginação */}
        {aba !== 'risco' && !isLoading && totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100" style={{ padding: '16px 24px' }}>
            <span className="text-xs text-slate-500">
              {tp('page', { pagina, total: totalPaginas, n: total })}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" className="flex gap-1"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                
                style={{ padding: '7px 12px' }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {tp('previous')}
              </Button>
              <Button variant="secondary" size="sm" className="flex gap-1"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                
                style={{ padding: '7px 12px' }}>
                {tp('next')}
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
