'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../lib/auth-context';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';

interface LogUtilizador {
  id: string;
  nome: string;
  role: string;
}

interface AuditLog {
  id: string;
  acao: string;
  entidadeId: string | null;
  entidadeTipo: string | null;
  detalhes: string | null;
  ip: string | null;
  createdAt: string;
  utilizador: LogUtilizador;
}

interface Resposta {
  total: number;
  pagina: number;
  totalPaginas: number;
  logs: AuditLog[];
}

interface UtilizadorOpcao {
  id: string;
  nome: string;
  role: string;
}

const roleLabel: Record<string, string> = {
  medico:        'Médico',
  enfermeiro:    'Enfermeiro',
  auxiliar:      'Auxiliar',
  tecnico_saude: 'Técnico de Saúde',
  farmaceutico:  'Farmacêutico',
  administrativo:'Administrativo',
  operacional:   'Operacional',
  ti:            'Tecnologias de Informação',
  qualidade:     'Qualidade',
  direcao:       'Direção',
};

function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function BadgeAcao({ acao }: { acao: string }) {
  const lower = acao.toLowerCase();
  let cor = 'bg-slate-100 text-slate-600';
  if (lower.includes('criar') || lower.includes('post') || lower.includes('admitir')) cor = 'bg-emerald-100 text-emerald-700';
  else if (lower.includes('login')) cor = 'bg-blue-100 text-blue-700';
  else if (lower.includes('eliminar') || lower.includes('delete') || lower.includes('remover')) cor = 'bg-red-100 text-red-700';
  else if (lower.includes('editar') || lower.includes('patch') || lower.includes('atualiz') || lower.includes('alter')) cor = 'bg-amber-100 text-amber-700';

  return (
    <span className={`inline-flex items-center text-xs font-semibold rounded-lg px-2.5 py-1 ${cor}`}>
      {acao}
    </span>
  );
}

export default function AuditoriaPagina() {
  const { utilizador, loading: authLoading } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(true);

  const [utilizadores, setUtilizadores] = useState<UtilizadorOpcao[]>([]);
  const [filtroUtilizador, setFiltroUtilizador] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('');
  const [filtroDe, setFiltroDe] = useState('');
  const [filtroAte, setFiltroAte] = useState('');
  const [filtroEntidade, setFiltroEntidade] = useState('');

  const ROLES_AUDITORIA = ['ti', 'qualidade', 'direcao', 'administrativo'];

  useEffect(() => {
    if (!authLoading && utilizador && !ROLES_AUDITORIA.includes(utilizador.role)) {
      router.replace('/dashboard');
    }
  }, [utilizador, authLoading, router]);

  useEffect(() => {
    api.get('/utilizadores').then((r) => setUtilizadores(r.data)).catch(() => {});
  }, []);

  const carregar = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(pg) };
      if (filtroUtilizador) params['utilizadorId']   = filtroUtilizador;
      if (filtroAcao)       params['acao']            = filtroAcao;
      if (filtroDe)         params['de']              = filtroDe;
      if (filtroAte)        params['ate']             = filtroAte;
      if (filtroEntidade)   params['entidadeTipo']    = filtroEntidade;

      const r = await api.get<Resposta>('/audit/logs', { params });
      setLogs(r.data.logs);
      setTotal(r.data.total);
      setTotalPaginas(r.data.totalPaginas);
      setPagina(r.data.pagina);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filtroUtilizador, filtroAcao, filtroDe, filtroAte]);

  useEffect(() => {
    if (utilizador && ROLES_AUDITORIA.includes(utilizador.role)) carregar(1);
  }, [utilizador, carregar]);

  const aplicarFiltros = (e: React.FormEvent) => {
    e.preventDefault();
    carregar(1);
  };

  const limparFiltros = () => {
    setFiltroUtilizador('');
    setFiltroAcao('');
    setFiltroDe('');
    setFiltroAte('');
    setFiltroEntidade('');
  };

  const exportarCSV = () => {
    const linhas = [
      ['Data', 'Utilizador', 'Role', 'Ação', 'Entidade', 'ID Entidade', 'IP'],
      ...logs.map(l => [
        formatarData(l.createdAt),
        l.utilizador?.nome ?? '—',
        l.utilizador?.role ?? '—',
        l.acao,
        l.entidadeTipo ?? '—',
        l.entidadeId ?? '—',
        l.ip ?? '—',
      ]),
    ];
    const csv = linhas.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `auditoria-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (authLoading || !utilizador) return null;
  if (!ROLES_AUDITORIA.includes(utilizador.role)) return null;

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 className="text-3xl font-bold text-slate-900">Auditoria</h1>
        <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>
          Registo de todas as ações realizadas no sistema
        </p>
      </div>

      {/* Filtros */}
      <form onSubmit={aplicarFiltros}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
          <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: '16px' }}>Filtros</p>
          <div className="grid grid-cols-5 gap-4" style={{ marginBottom: '16px' }}>
            {/* Utilizador */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
                Utilizador
              </label>
              <select
                value={filtroUtilizador}
                onChange={(e) => setFiltroUtilizador(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                style={{ padding: '9px 12px' }}
              >
                <option value="">Todos</option>
                {utilizadores.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome} ({roleLabel[u.role] ?? u.role})</option>
                ))}
              </select>
            </div>

            {/* Ação */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
                Ação (contém)
              </label>
              <input
                value={filtroAcao}
                onChange={(e) => setFiltroAcao(e.target.value)}
                placeholder="Ex: login, criar, eliminar..."
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                style={{ padding: '9px 12px' }}
              />
            </div>

            {/* De */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
                De
              </label>
              <input
                type="date"
                value={filtroDe}
                onChange={(e) => setFiltroDe(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition bg-white"
                style={{ padding: '9px 12px' }}
              />
            </div>

            {/* Até */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
                Até
              </label>
              <input
                type="date"
                value={filtroAte}
                onChange={(e) => setFiltroAte(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition bg-white"
                style={{ padding: '9px 12px' }}
              />
            </div>

            {/* Entidade */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
                Entidade
              </label>
              <select
                value={filtroEntidade}
                onChange={(e) => setFiltroEntidade(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                style={{ padding: '9px 12px' }}
              >
                <option value="">Todas</option>
                {['Doente', 'Utilizador', 'StockItem', 'Medicacao', 'Tarefa', 'Cama', 'Equipamento', 'IncidenteTI', 'EpisodioFaturacao', 'Turno'].map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              style={{ padding: '9px 20px' }}
            >
              Pesquisar
            </button>
            <button
              type="button"
              onClick={limparFiltros}
              className="border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors"
              style={{ padding: '9px 20px' }}
            >
              Limpar
            </button>
            {logs.length > 0 && (
              <button
                type="button"
                onClick={exportarCSV}
                className="flex items-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors"
                style={{ padding: '9px 20px' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Exportar CSV
              </button>
            )}
            {total > 0 && (
              <span className="text-xs text-slate-400" style={{ marginLeft: '8px' }}>
                {total} registo{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </form>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 text-slate-400" style={{ padding: '60px' }}>
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">A carregar...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-slate-400" style={{ padding: '80px' }}>
            <svg className="w-12 h-12" style={{ marginBottom: '16px', opacity: 0.4 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">Nenhum registo encontrado</p>
          </div>
        ) : (
          <>
            {/* Cabeçalho da tabela */}
            <div
              className="grid text-xs font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100"
              style={{ gridTemplateColumns: '180px 1fr 200px 120px 140px', padding: '12px 24px' }}
            >
              <span>Data/Hora</span>
              <span>Ação</span>
              <span>Utilizador</span>
              <span>Entidade</span>
              <span>IP</span>
            </div>

            {/* Linhas */}
            {logs.map((log, i) => (
              <div
                key={log.id}
                className="grid items-center hover:bg-slate-50 transition-colors"
                style={{
                  gridTemplateColumns: '180px 1fr 200px 120px 140px',
                  padding: '14px 24px',
                  borderBottom: i < logs.length - 1 ? '1px solid #f8fafc' : 'none',
                }}
              >
                {/* Data */}
                <span className="text-xs text-slate-500 font-mono">{formatarData(log.createdAt)}</span>

                {/* Ação + detalhes */}
                <div>
                  <BadgeAcao acao={log.acao} />
                  {log.detalhes && (
                    <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>{log.detalhes}</p>
                  )}
                </div>

                {/* Utilizador */}
                <div>
                  <p className="text-sm font-medium text-slate-700">{log.utilizador.nome}</p>
                  <p className="text-xs text-slate-400">{roleLabel[log.utilizador.role] ?? log.utilizador.role}</p>
                </div>

                {/* Entidade */}
                <div>
                  {log.entidadeTipo ? (
                    <>
                      <span className="text-xs font-semibold text-slate-600">{log.entidadeTipo}</span>
                      {log.entidadeId && (
                        <p className="text-[10px] text-slate-400 font-mono" style={{ marginTop: '2px' }}>
                          {log.entidadeId.slice(0, 8)}…
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </div>

                {/* IP */}
                <span className="text-xs font-mono text-slate-400">{log.ip ?? '—'}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between" style={{ marginTop: '20px' }}>
          <p className="text-sm text-slate-400">
            Página {pagina} de {totalPaginas}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => carregar(pagina - 1)}
              disabled={pagina <= 1}
              className="border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{ padding: '8px 16px' }}
            >
              ← Anterior
            </button>
            {Array.from({ length: Math.min(totalPaginas, 7) }, (_, i) => {
              const pg = pagina <= 4
                ? i + 1
                : pagina + i - Math.min(3, totalPaginas - pagina > 3 ? 3 : totalPaginas - pagina);
              if (pg < 1 || pg > totalPaginas) return null;
              return (
                <button
                  key={pg}
                  onClick={() => carregar(pg)}
                  className={`w-9 h-9 text-sm font-medium rounded-xl transition-colors ${
                    pg === pagina
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              onClick={() => carregar(pagina + 1)}
              disabled={pagina >= totalPaginas}
              className="border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{ padding: '8px 16px' }}
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
