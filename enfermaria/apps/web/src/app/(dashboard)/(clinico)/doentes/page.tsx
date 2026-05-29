'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';

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

const ROLES_CLINICOS = ['medico', 'enfermeiro', 'auxiliar', 'tecnico_saude', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos'];
const LIMIT = 25;

export default function DoentesPagina() {
  const { utilizador } = useAuth();
  const [pesquisa, setPesquisa] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroServico, setFiltroServico] = useState('');
  const [pagina, setPagina] = useState(1);
  const [aba, setAba] = useState<'meus' | 'todos'>('meus');

  const isClinico = ROLES_CLINICOS.includes(utilizador?.role ?? '');
  const podeAdmitir = ['administrativo', 'enfermeiro', 'medico'].includes(utilizador?.role ?? '');

  const todos = !isClinico || aba === 'todos';
  const { data, isLoading } = useQuery({
    queryKey: ['doentes', pagina, todos],
    queryFn: () =>
      api.get(`/doentes?page=${pagina}&limit=${LIMIT}${todos ? '&todos=true' : ''}`).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const doentes: Doente[] = data?.data ?? data ?? [];
  const total: number = data?.total ?? doentes.length;
  const totalPaginas: number = data?.totalPaginas ?? 1;

  const mudarAba = (novaAba: 'meus' | 'todos') => { setAba(novaAba); setPagina(1); };

  const filtrados = doentes.filter((d) => {
    const matchText = !pesquisa || d.nome.toLowerCase().includes(pesquisa.toLowerCase()) || d.numeroProcesso.includes(pesquisa) || (d.cama?.numero ?? '').includes(pesquisa);
    const matchEstado = !filtroEstado || d.estado === filtroEstado;
    const matchServico = !filtroServico || d.cama?.servico === filtroServico;
    return matchText && matchEstado && matchServico;
  });

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Doentes</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>
            {total} {total === 1 ? 'doente internado' : 'doentes internados'}
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
            Admitir Doente
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

        {/* Tabs — só para clínicos */}
        {isClinico && (
          <div className="flex border-b border-slate-100" style={{ padding: '0 24px' }}>
            {(['meus', 'todos'] as const).map((t) => (
              <button
                key={t}
                onClick={() => mudarAba(t)}
                className={`text-sm font-medium transition-colors relative ${
                  aba === t ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                }`}
                style={{ padding: '14px 0', marginRight: '24px' }}
              >
                {t === 'meus' ? 'Meus Doentes' : 'Todos os Doentes'}
                {aba === t && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100" style={{ padding: '12px 24px' }}>
          <label htmlFor="filtro-estado" className="sr-only">Filtrar por estado</label>
          <select id="filtro-estado" value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPagina(1); }}
            className="text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ padding: '7px 12px' }}>
            <option value="">Todos os estados</option>
            <option value="estavel">Estável</option>
            <option value="grave">Grave</option>
            <option value="critico">Crítico</option>
          </select>
          <label htmlFor="filtro-servico" className="sr-only">Filtrar por serviço</label>
          <select id="filtro-servico" value={filtroServico} onChange={e => { setFiltroServico(e.target.value); setPagina(1); }}
            className="text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ padding: '7px 12px' }}>
            <option value="">Todos os serviços</option>
            <option value="internamento">Internamento</option>
            <option value="urgencia">Urgência</option>
            <option value="uci">UCI</option>
            <option value="bloco_operatorio">Bloco Operatório</option>
          </select>
          {(filtroEstado || filtroServico) && (
            <button onClick={() => { setFiltroEstado(''); setFiltroServico(''); }} className="text-xs text-slate-400 hover:text-slate-600">Limpar filtros</button>
          )}
        </div>

        {/* Barra de pesquisa */}
        <div className="flex items-center gap-3 border-b border-slate-100" style={{ padding: '16px 24px' }}>
          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar por nome, processo ou cama..."
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            className="flex-1 text-sm text-slate-700 placeholder-slate-400 bg-transparent focus:outline-none"
          />
          {pesquisa && (
            <button onClick={() => setPesquisa('')} aria-label="Limpar pesquisa" className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {isLoading ? (
          <div role="status" aria-live="polite" aria-busy="true" aria-label="A carregar doentes"
            className="flex items-center justify-center gap-3 text-slate-400" style={{ padding: '64px' }}>
            <svg className="animate-spin w-5 h-5" aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">A carregar...</span>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center" style={{ padding: '64px' }}>
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center" style={{ marginBottom: '16px' }}>
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium text-sm" style={{ marginBottom: '4px' }}>
              {pesquisa
                ? 'Nenhum doente encontrado'
                : aba === 'meus'
                  ? 'Sem doentes atribuídos neste turno'
                  : 'Sem doentes internados'}
            </p>
            <p className="text-slate-400 text-xs">
              {pesquisa
                ? 'Tente outro termo de pesquisa'
                : aba === 'meus'
                  ? 'Os doentes do seu turno aparecerão aqui. Veja "Todos os Doentes" para a lista completa.'
                  : 'Os doentes admitidos aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th scope="col" className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '13px 24px 13px 36px' }}>Doente</th>
                  <th scope="col" className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Processo</th>
                  <th scope="col" className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Cama</th>
                  <th scope="col" className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Diagnóstico</th>
                  <th scope="col" className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Estado</th>
                  <th scope="col" className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Admissão</th>
                  <th scope="col" className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide" style={{ padding: '13px 16px' }}>Alta Prevista</th>
                  <th scope="col" style={{ padding: '13px 24px' }}><span className="sr-only">Ações</span></th>
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
                        {estadoLabel[d.estado] ?? d.estado}
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
        )}

        {/* Paginação */}
        {!isLoading && totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100" style={{ padding: '16px 24px' }}>
            <span className="text-xs text-slate-500">
              Página {pagina} de {totalPaginas} · {total} doentes
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                style={{ padding: '7px 12px' }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Anterior
              </button>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                style={{ padding: '7px 12px' }}>
                Próxima
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
