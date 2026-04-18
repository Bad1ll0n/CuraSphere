'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';

interface DashTI {
  utilizadores: {
    total: number;
    porRole: { role: string; total: number }[];
    sessoesMobile: number;
  };
  auditoria: {
    acoesHoje: number;
    topAcoes: { acao: string; total: number }[];
    recentes: {
      id: string;
      acao: string;
      entidadeTipo: string | null;
      utilizador: { nome: string; role: string };
      createdAt: string;
      ip: string | null;
    }[];
  };
  infraestrutura: {
    totalDoentes: number;
    totalCamas: number;
    camasOcupadas: number;
    taxaOcupacao: number;
    isolados: number;
  };
}

const ROLE_LABELS: Record<string, string> = {
  medico: 'Médico', medico_especialista: 'Médico Especialista', chefe_medicos: 'Chefe Médicos',
  enfermeiro: 'Enfermeiro', enfermeiro_especialista: 'Enf. Especialista', chefe_enfermeiros: 'Chefe Enfermeiros',
  chefe_turno: 'Chefe de Turno', administrativo: 'Administrativo', auxiliar_saude: 'Auxiliar',
  farmaceutico: 'Farmacêutico', tecnico: 'Técnico', radiologista: 'Radiologista',
  fisioterapeuta: 'Fisioterapeuta', diretor_ti: 'Diretor TI', rececionista: 'Rececionista',
};

const ACAO_COR: Record<string, string> = {
  POST: 'bg-green-50 text-green-700',
  PATCH: 'bg-amber-50 text-amber-700',
  DELETE: 'bg-red-50 text-red-700',
  GET: 'bg-blue-50 text-blue-600',
  login: 'bg-purple-50 text-purple-700',
};

function acaoCor(acao: string) {
  for (const [key, val] of Object.entries(ACAO_COR)) {
    if (acao.toUpperCase().startsWith(key)) return val;
  }
  return 'bg-slate-100 text-slate-600';
}

function StatCard({ label, value, sub, cor = 'text-slate-900' }: { label: string; value: string | number; sub?: string; cor?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${cor}`} style={{ marginTop: '6px' }}>{value}</p>
      {sub && <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>{sub}</p>}
    </div>
  );
}

export default function DashboardTIPage() {
  const [dados, setDados] = useState<DashTI | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = () => {
    setLoading(true);
    api.get('/dashboard/ti')
      .then(r => setDados(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard TI</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>Monitorização do sistema e atividade de utilizadores</p>
        </div>
        <button onClick={carregar} className="border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2" style={{ padding: '10px 18px' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 text-slate-400" style={{ padding: '80px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar dados do sistema...</span>
        </div>
      ) : dados && (
        <div className="flex flex-col gap-8">

          {/* Infraestrutura */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '12px' }}>Infraestrutura Clínica</h2>
            <div className="grid grid-cols-5 gap-4">
              <StatCard label="Doentes Internados" value={dados.infraestrutura.totalDoentes} />
              <StatCard label="Total de Camas" value={dados.infraestrutura.totalCamas} />
              <StatCard label="Camas Ocupadas" value={dados.infraestrutura.camasOcupadas} />
              <StatCard
                label="Taxa de Ocupação"
                value={`${dados.infraestrutura.taxaOcupacao}%`}
                cor={dados.infraestrutura.taxaOcupacao > 90 ? 'text-red-600' : dados.infraestrutura.taxaOcupacao > 75 ? 'text-amber-600' : 'text-green-600'}
              />
              <StatCard
                label="Em Isolamento IACS"
                value={dados.infraestrutura.isolados}
                cor={dados.infraestrutura.isolados > 0 ? 'text-orange-600' : 'text-slate-900'}
              />
            </div>
          </section>

          {/* Utilizadores */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '12px' }}>Utilizadores do Sistema</h2>
            <div className="grid grid-cols-3 gap-4" style={{ marginBottom: '16px' }}>
              <StatCard label="Utilizadores Ativos" value={dados.utilizadores.total} cor="text-blue-600" />
              <StatCard label="Sessões Mobile" value={dados.utilizadores.sessoesMobile} sub="Tokens registados" />
              <StatCard label="Ações Hoje" value={dados.auditoria.acoesHoje} sub="Operações registadas no audit log" />
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '14px' }}>Distribuição por Função</p>
              <div className="grid grid-cols-3 gap-3">
                {dados.utilizadores.porRole
                  .sort((a, b) => b.total - a.total)
                  .map(r => (
                    <div key={r.role} className="flex items-center justify-between bg-slate-50 rounded-xl" style={{ padding: '10px 14px' }}>
                      <span className="text-sm text-slate-700">{ROLE_LABELS[r.role] ?? r.role}</span>
                      <span className="text-sm font-bold text-slate-900">{r.total}</span>
                    </div>
                  ))}
              </div>
            </div>
          </section>

          {/* Audit Log */}
          <div className="grid grid-cols-2 gap-6">
            {/* Top Ações */}
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '12px' }}>Top Operações — Última Semana</h2>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
                {dados.auditoria.topAcoes.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center" style={{ padding: '20px 0' }}>Sem dados</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dados.auditoria.topAcoes.map((a, i) => {
                      const max = dados.auditoria.topAcoes[0].total;
                      return (
                        <div key={a.acao}>
                          <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${acaoCor(a.acao)}`}>{a.acao}</span>
                            <span className="text-xs font-bold text-slate-700">{a.total}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${(a.total / max) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Atividade Recente */}
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '12px' }}>Atividade Recente Hoje</h2>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {dados.auditoria.recentes.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center" style={{ padding: '40px' }}>Sem atividade hoje</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {dados.auditoria.recentes.map(a => (
                      <div key={a.id} className="flex items-start gap-3" style={{ padding: '12px 16px' }}>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${acaoCor(a.acao)}`}>{a.acao.substring(0, 10)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">{a.utilizador.nome}</p>
                          {a.entidadeTipo && <p className="text-xs text-slate-400">{a.entidadeTipo}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</p>
                          {a.ip && <p className="text-xs text-slate-300">{a.ip}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
