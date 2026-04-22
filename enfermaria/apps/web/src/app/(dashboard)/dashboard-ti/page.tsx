'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';

interface Incidente {
  id: string; titulo: string; tipo: string; prioridade: string; estado: string;
  criadoEm: string; criadoPor: { nome: string } | null;
}

interface DashTI {
  utilizadores: { total: number; porRole: { role: string; total: number }[]; sessoesMobile: number };
  auditoria: {
    acoesHoje: number;
    topAcoes: { acao: string; total: number }[];
    recentes: { id: string; acao: string; entidadeTipo: string | null; utilizador: { nome: string; role: string } | null; createdAt: string; ip: string | null }[];
  };
  incidentes: {
    abertos: number; emAnalise: number; criticos: number; resolvidosHoje: number;
    porSubRole: { subRole: string; total: number }[];
    porTipo: { tipo: string; total: number }[];
    recentes: Incidente[];
  };
}

type FiltroKey = 'abertos' | 'emAnalise' | 'criticos' | 'resolvidos' | null;
interface Filtro { key: FiltroKey; label: string; tipo: 'estado' | 'prioridade'; valor: string }

const FILTROS: Record<Exclude<FiltroKey, null>, Filtro> = {
  abertos:    { key: 'abertos',    label: 'Abertos',       tipo: 'estado',     valor: 'aberto' },
  emAnalise:  { key: 'emAnalise',  label: 'Em Análise',    tipo: 'estado',     valor: 'em_analise' },
  criticos:   { key: 'criticos',   label: 'Críticos',      tipo: 'prioridade', valor: 'critica' },
  resolvidos: { key: 'resolvidos', label: 'Resolvidos',    tipo: 'estado',     valor: 'resolvido' },
};

const ROLE_LABELS: Record<string, string> = {
  medico:        'Médico',
  enfermeiro:    'Enfermeiro',
  auxiliar:      'Auxiliar',
  tecnico_saude: 'Técnico de Saúde',
  farmaceutico:  'Farmacêutico',
  administrativo:'Administrativo',
  operacional:   'Operacional',
  ti:            'TI',
  qualidade:     'Qualidade',
  direcao:       'Direção',
};

const TIPO_LABEL: Record<string, string> = {
  infraestrutura: 'Infraestrutura', rede: 'Rede', his_erp: 'HIS/ERP',
  base_dados: 'Base de Dados', seguranca: 'Segurança', dados_clinicos: 'Dados Clínicos', outro: 'Outro',
};

const SUBROLE_LABEL: Record<string, string> = {
  sysadmin: 'Sysadmin', his_erp: 'HIS/ERP', database_admin: 'DBA',
  security_officer: 'Segurança', dados_clinicos: 'Dados Clínicos',
};

const PRIORIDADE_COR: Record<string, string> = {
  critica: 'bg-red-100 text-red-700', alta: 'bg-orange-100 text-orange-700',
  media: 'bg-yellow-100 text-yellow-700', baixa: 'bg-green-100 text-green-700',
};
const ESTADO_COR: Record<string, string> = {
  aberto: 'bg-red-100 text-red-700', em_analise: 'bg-amber-100 text-amber-700',
  resolvido: 'bg-green-100 text-green-700', fechado: 'bg-slate-100 text-slate-500',
};
const PRIORIDADE_LABEL: Record<string, string> = {
  critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa',
};
const ESTADO_LABEL: Record<string, string> = {
  aberto: 'Aberto', em_analise: 'Em Análise', resolvido: 'Resolvido', fechado: 'Fechado',
};

const ACAO_COR: Record<string, string> = {
  POST: 'bg-green-50 text-green-700', PATCH: 'bg-amber-50 text-amber-700',
  DELETE: 'bg-red-50 text-red-700', GET: 'bg-blue-50 text-blue-600', login: 'bg-purple-50 text-purple-700',
};
function acaoCor(acao: string) {
  for (const [key, val] of Object.entries(ACAO_COR)) {
    if (acao.toUpperCase().startsWith(key)) return val;
  }
  return 'bg-slate-100 text-slate-600';
}

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${map[value] ?? 'bg-slate-100 text-slate-500'}`}>
      {value}
    </span>
  );
}

interface IncidenteCardProps {
  label: string; value: number; cor: string; bordaCor: string; ativo: boolean; onClick: () => void;
}
function IncidenteCard({ label, value, cor, bordaCor, ativo, onClick }: IncidenteCardProps) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md ${ativo ? `ring-2 ${bordaCor}` : 'border-slate-100 hover:border-slate-200'}`}
      style={{ padding: '20px 24px', width: '100%' }}
    >
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>{label}</p>
      <p className={`text-4xl font-bold ${cor}`}>{value}</p>
      <p className="text-xs text-slate-400 flex items-center gap-1" style={{ marginTop: '8px' }}>
        <span>Ver listagem</span>
        <span>›</span>
      </p>
    </button>
  );
}

function TabelaIncidentes({ incidentes, titulo }: { incidentes: Incidente[]; titulo: string }) {
  if (incidentes.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center" style={{ padding: '48px' }}>
        <div className="text-center">
          <p className="text-slate-400 text-sm font-medium">Nenhum incidente</p>
          <p className="text-slate-300 text-xs" style={{ marginTop: '4px' }}>Não existem incidentes com este filtro</p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="border-b border-slate-100" style={{ padding: '16px 24px' }}>
        <p className="text-sm font-semibold text-slate-700">{titulo} <span className="text-slate-400 font-normal">({incidentes.length})</span></p>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-50">
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Incidente</th>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Tipo</th>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Prioridade</th>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Estado</th>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Criado por</th>
            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Data</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {incidentes.map(inc => (
            <tr key={inc.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-3">
                <p className="text-sm font-medium text-slate-900">{inc.titulo}</p>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-slate-600">{TIPO_LABEL[inc.tipo] ?? inc.tipo}</span>
              </td>
              <td className="px-4 py-3">
                <Badge value={PRIORIDADE_LABEL[inc.prioridade] ?? inc.prioridade} map={PRIORIDADE_COR} />
              </td>
              <td className="px-4 py-3">
                <Badge value={ESTADO_LABEL[inc.estado] ?? inc.estado} map={ESTADO_COR} />
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-slate-600">{inc.criadoPor?.nome ?? '—'}</span>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-slate-400">
                  {new Date(inc.criadoEm).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardTIPage() {
  const [dados, setDados] = useState<DashTI | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroKey>(null);
  const [listaFiltrada, setListaFiltrada] = useState<Incidente[]>([]);
  const [loadingFiltro, setLoadingFiltro] = useState(false);

  const carregar = () => {
    setLoading(true);
    api.get('/dashboard/ti')
      .then(r => setDados(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const abrirFiltro = async (key: FiltroKey) => {
    if (key === null || key === filtroAtivo) { setFiltroAtivo(null); return; }
    setFiltroAtivo(key);
    setLoadingFiltro(true);
    try {
      const { data } = await api.get('/incidentes-ti');
      const todos: Incidente[] = Array.isArray(data) ? data : [];
      const f = FILTROS[key];
      setListaFiltrada(todos.filter(i => f.tipo === 'estado' ? i.estado === f.valor : i.prioridade === f.valor));
    } catch { setListaFiltrada([]); }
    finally { setLoadingFiltro(false); }
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard TI</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>Monitorização de incidentes, sistema e atividade de utilizadores</p>
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

          {/* ── Incidentes TI ── */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '12px' }}>
              Incidentes TI · clique para filtrar
            </h2>
            <div className="grid grid-cols-4 gap-4" style={{ marginBottom: filtroAtivo ? '20px' : '0' }}>
              <IncidenteCard
                label="Abertos" value={dados.incidentes.abertos} cor="text-red-600"
                bordaCor="ring-red-400" ativo={filtroAtivo === 'abertos'}
                onClick={() => abrirFiltro('abertos')}
              />
              <IncidenteCard
                label="Em Análise" value={dados.incidentes.emAnalise} cor="text-amber-600"
                bordaCor="ring-amber-400" ativo={filtroAtivo === 'emAnalise'}
                onClick={() => abrirFiltro('emAnalise')}
              />
              <IncidenteCard
                label="Críticos" value={dados.incidentes.criticos} cor="text-red-700"
                bordaCor="ring-red-600" ativo={filtroAtivo === 'criticos'}
                onClick={() => abrirFiltro('criticos')}
              />
              <IncidenteCard
                label="Resolvidos Hoje" value={dados.incidentes.resolvidosHoje} cor="text-green-600"
                bordaCor="ring-green-400" ativo={filtroAtivo === 'resolvidos'}
                onClick={() => abrirFiltro('resolvidos')}
              />
            </div>

            {/* Tabela filtrada */}
            {filtroAtivo && (
              loadingFiltro ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center" style={{ padding: '40px' }}>
                  <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : (
                <TabelaIncidentes incidentes={listaFiltrada} titulo={`Incidentes — ${FILTROS[filtroAtivo].label}`} />
              )
            )}
          </section>

          {/* ── Distribuição ── */}
          <div className="grid grid-cols-2 gap-6">
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '12px' }}>Por Tipo</h2>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
                {dados.incidentes.porTipo.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center" style={{ padding: '20px 0' }}>Sem dados</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {dados.incidentes.porTipo.map(t => {
                      const max = Math.max(...dados.incidentes.porTipo.map(x => x.total));
                      return (
                        <div key={t.tipo}>
                          <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                            <span className="text-xs text-slate-600">{TIPO_LABEL[t.tipo] ?? t.tipo}</span>
                            <span className="text-xs font-bold text-slate-800">{t.total}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${(t.total / max) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '12px' }}>Por Equipa TI</h2>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
                {dados.incidentes.porSubRole.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center" style={{ padding: '20px 0' }}>Sem dados</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dados.incidentes.porSubRole.map(r => (
                      <div key={r.subRole} className="flex items-center justify-between bg-slate-50 rounded-xl" style={{ padding: '10px 14px' }}>
                        <span className="text-sm text-slate-700">{SUBROLE_LABEL[r.subRole] ?? r.subRole ?? 'Geral'}</span>
                        <span className="text-sm font-bold text-slate-900">{r.total}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ── Incidentes recentes ── */}
          {dados.incidentes.recentes.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '12px' }}>Incidentes Recentes</h2>
              <TabelaIncidentes incidentes={dados.incidentes.recentes} titulo="Recentes" />
            </section>
          )}

          {/* ── Utilizadores ── */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '12px' }}>Utilizadores do Sistema</h2>
            <div className="grid grid-cols-3 gap-4" style={{ marginBottom: '16px' }}>
              {[
                { label: 'Utilizadores Ativos', value: dados.utilizadores.total, cor: 'text-blue-600' },
                { label: 'Sessões Mobile', value: dados.utilizadores.sessoesMobile, cor: 'text-violet-600' },
                { label: 'Ações Hoje', value: dados.auditoria.acoesHoje, cor: 'text-slate-900' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{c.label}</p>
                  <p className={`text-3xl font-bold ${c.cor}`} style={{ marginTop: '6px' }}>{c.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '14px' }}>Distribuição por Função</p>
              <div className="grid grid-cols-3 gap-3">
                {dados.utilizadores.porRole.sort((a, b) => b.total - a.total).map(r => (
                  <div key={r.role} className="flex items-center justify-between bg-slate-50 rounded-xl" style={{ padding: '10px 14px' }}>
                    <span className="text-sm text-slate-700">{ROLE_LABELS[r.role] ?? r.role}</span>
                    <span className="text-sm font-bold text-slate-900">{r.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Audit Log ── */}
          <div className="grid grid-cols-2 gap-6">
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '12px' }}>Top Operações — Última Semana</h2>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
                {dados.auditoria.topAcoes.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center" style={{ padding: '20px 0' }}>Sem dados</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dados.auditoria.topAcoes.map(a => {
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

            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '12px' }}>Atividade Recente</h2>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {dados.auditoria.recentes.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center" style={{ padding: '40px' }}>Sem atividade hoje</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {dados.auditoria.recentes.map(a => (
                      <div key={a.id} className="flex items-start gap-3" style={{ padding: '12px 16px' }}>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${acaoCor(a.acao)}`}>{a.acao.substring(0, 12)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">{a.utilizador?.nome ?? 'Sistema'}</p>
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
