'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';

interface AuditEntry {
  id: string;
  acao: string;
  entidadeId?: string;
  entidadeTipo?: string;
  ip?: string;
  createdAt: string;
  utilizador?: { id: string; nome: string; role: string };
}

interface ConformidadeDados {
  acessosDoentes: AuditEntry[];
  acoesAltoRisco: AuditEntry[];
  totalUtilizadoresUnicos: number;
  totalAcessos30dias: number;
  acessosPorDia: { dia: string; total: number }[];
}

const CHECKLIST = [
  { id: 'rgpd_1', label: 'Registo de acessos a dados pessoais activo', categoria: 'RGPD' },
  { id: 'rgpd_2', label: 'Política de retenção de dados documentada', categoria: 'RGPD' },
  { id: 'rgpd_3', label: 'Designação de DPO comunicada à CNPD', categoria: 'RGPD' },
  { id: 'dgs_1',  label: 'Notificação de incidentes de segurança à DGS', categoria: 'DGS' },
  { id: 'dgs_2',  label: 'Plano de emergência hospitalar actualizado', categoria: 'DGS' },
  { id: 'acss_1', label: 'Relatório de qualidade enviado à ACSS', categoria: 'ACSS' },
  { id: 'acss_2', label: 'Indicadores de segurança do doente registados', categoria: 'ACSS' },
  { id: 'sns_1',  label: 'Integração SNS24 testada', categoria: 'SNS' },
];

const ROLE_LABEL: Record<string, string> = {
  medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
  tecnico_saude: 'Técnico de Saúde', farmaceutico: 'Farmacêutico',
  administrativo: 'Administrativo', operacional: 'Operacional',
  ti: 'TI', qualidade: 'Qualidade', direcao: 'Direção',
};

type CheckState = 'conforme' | 'verificar' | 'nao_conforme';
const CHECK_COR: Record<CheckState, string> = {
  conforme:      'bg-green-50 text-green-700 border-green-200',
  verificar:     'bg-amber-50 text-amber-700 border-amber-200',
  nao_conforme:  'bg-red-50 text-red-600 border-red-200',
};
const CHECK_LABEL: Record<CheckState, string> = {
  conforme: 'Conforme', verificar: 'A Verificar', nao_conforme: 'Não Conforme',
};

export default function ConformidadePage() {
  const [checkStates, setCheckStates] = useState<Record<string, CheckState>>(
    Object.fromEntries(CHECKLIST.map(c => [c.id, 'verificar']))
  );
  const [aba, setAba] = useState<'rgpd' | 'checklist' | 'alto_risco'>('rgpd');

  const { data, isLoading } = useQuery<ConformidadeDados>({
    queryKey: ['conformidade'],
    queryFn: () => api.get('/audit/conformidade').then(r => r.data),
    staleTime: 60_000,
  });

  const toggleCheck = (id: string) => {
    const estados: CheckState[] = ['verificar', 'conforme', 'nao_conforme'];
    setCheckStates(prev => {
      const idx = estados.indexOf(prev[id]);
      return { ...prev, [id]: estados[(idx + 1) % 3] };
    });
  };

  const exportarCSV = () => {
    if (!data) return;
    const linhas = [
      ['Data', 'Utilizador', 'Role', 'Ação', 'Entidade', 'IP'],
      ...data.acessosDoentes.map(a => [
        new Date(a.createdAt).toLocaleString('pt-PT'),
        a.utilizador?.nome ?? '', a.utilizador?.role ?? '',
        a.acao, a.entidadeTipo ?? '', a.ip ?? '',
      ]),
    ];
    const csv = linhas.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rgpd-acessos-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const conformes   = Object.values(checkStates).filter(s => s === 'conforme').length;
  const naConforme  = Object.values(checkStates).filter(s => s === 'nao_conforme').length;

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conformidade & RGPD</h1>
          <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>Monitorização de acessos, RGPD e conformidade regulatória</p>
        </div>
        <button onClick={exportarCSV}
          className="flex items-center gap-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          style={{ padding: '9px 16px' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="flex items-center justify-center" style={{ padding: '60px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl" style={{ padding: '18px 20px' }}>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Acessos a Dados (30 dias)</p>
              <p className="text-2xl font-bold text-blue-700" style={{ marginTop: '4px' }}>{data?.totalAcessos30dias ?? 0}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl" style={{ padding: '18px 20px' }}>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Utilizadores com Acesso</p>
              <p className="text-2xl font-bold text-slate-700" style={{ marginTop: '4px' }}>{data?.totalUtilizadoresUnicos ?? 0}</p>
            </div>
            <div className={`border rounded-2xl ${naConforme > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`} style={{ padding: '18px 20px' }}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${naConforme > 0 ? 'text-red-600' : 'text-green-600'}`}>Não Conformes</p>
              <p className={`text-2xl font-bold ${naConforme > 0 ? 'text-red-700' : 'text-green-700'}`} style={{ marginTop: '4px' }}>{naConforme}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl" style={{ padding: '18px 20px' }}>
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Conformes</p>
              <p className="text-2xl font-bold text-green-700" style={{ marginTop: '4px' }}>{conformes} / {CHECKLIST.length}</p>
            </div>
          </div>

          {/* Gráfico de acessos por dia */}
          {data && data.acessosPorDia.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm" style={{ padding: '20px 24px', marginBottom: '24px' }}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '16px' }}>Acessos a Dados de Doentes — Últimos 7 dias</p>
              <div className="flex items-end gap-2" style={{ height: '80px' }}>
                {(() => {
                  const max = Math.max(...data.acessosPorDia.map(d => d.total), 1);
                  return data.acessosPorDia.map(d => (
                    <div key={d.dia} className="flex flex-col items-center flex-1 gap-1">
                      <span className="text-xs text-slate-600 font-semibold">{d.total}</span>
                      <div className="w-full bg-blue-500 rounded-t-md" style={{ height: `${(d.total / max) * 56}px`, minHeight: '4px' }} />
                      <span className="text-xs text-slate-400">{d.dia.slice(5)}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1" style={{ marginBottom: '20px', width: 'fit-content' }}>
            {([
              { key: 'rgpd', label: 'Acessos RGPD' },
              { key: 'alto_risco', label: `Ações Alto Risco (${data?.acoesAltoRisco.length ?? 0})` },
              { key: 'checklist', label: 'Checklist Regulatório' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setAba(t.key)}
                className={`text-sm font-medium rounded-lg transition-all ${aba === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                style={{ padding: '8px 18px' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Acessos RGPD */}
          {aba === 'rgpd' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="border-b border-slate-100" style={{ padding: '14px 20px' }}>
                <p className="text-sm font-semibold text-slate-700">Acessos a Dados de Doentes — últimos 30 dias</p>
              </div>
              {!data || data.acessosDoentes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center" style={{ padding: '40px' }}>Sem registos</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {data.acessosDoentes.map(a => (
                    <div key={a.id} className="flex items-center gap-4" style={{ padding: '12px 20px' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{a.utilizador?.nome ?? 'Sistema'}</p>
                        <p className="text-xs text-slate-400">{ROLE_LABEL[a.utilizador?.role ?? ''] ?? a.utilizador?.role} · {a.acao}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                        {a.ip && <p className="text-xs text-slate-300">{a.ip}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Ações Alto Risco */}
          {aba === 'alto_risco' && (
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
              <div className="border-b border-red-100" style={{ padding: '14px 20px' }}>
                <p className="text-sm font-semibold text-red-700">Ações de Alto Risco — últimos 30 dias</p>
              </div>
              {!data || data.acoesAltoRisco.length === 0 ? (
                <p className="text-sm text-slate-400 text-center" style={{ padding: '40px' }}>Sem registos de alto risco</p>
              ) : (
                <div className="divide-y divide-red-50">
                  {data.acoesAltoRisco.map(a => (
                    <div key={a.id} className="flex items-center gap-4" style={{ padding: '12px 20px' }}>
                      <span className="shrink-0 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">{a.acao}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{a.utilizador?.nome ?? 'Sistema'}</p>
                        <p className="text-xs text-slate-400">{ROLE_LABEL[a.utilizador?.role ?? ''] ?? a.utilizador?.role}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                        {a.ip && <p className="text-xs text-slate-300">{a.ip}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Checklist */}
          {aba === 'checklist' && (
            <div className="flex flex-col gap-3">
              {['RGPD', 'DGS', 'ACSS', 'SNS'].map(cat => (
                <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest" style={{ marginBottom: '12px' }}>{cat}</p>
                  <div className="flex flex-col gap-2">
                    {CHECKLIST.filter(c => c.categoria === cat).map(c => {
                      const estado = checkStates[c.id];
                      return (
                        <div key={c.id} className="flex items-center justify-between gap-3">
                          <p className="text-sm text-slate-700">{c.label}</p>
                          <button onClick={() => toggleCheck(c.id)}
                            className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${CHECK_COR[estado]}`}>
                            {CHECK_LABEL[estado]}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
