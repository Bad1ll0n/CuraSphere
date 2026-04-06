'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../lib/auth-context';
import api from '../../../../lib/api';

interface Doente {
  id: string;
  nome: string;
  numeroProcesso: string;
  dataNascimento: string;
  estado: string;
  diagnosticoPrincipal: string;
  dataAdmissao: string;
  dataAltaPrevista?: string;
  dataAlta?: string;
  ativo: boolean;
  cama: { numero: string; quarto: string };
  atribuicoes: { enfermeiro: { id: string; nome: string; role: string } }[];
  tarefas: Tarefa[];
  medicacoes: Medicacao[];
  notasTurno: NotaTurno[];
}

interface Tarefa {
  id: string;
  descricao: string;
  tipo: string;
  prioridade: string;
  estado: string;
  prazo?: string;
  criadaEm: string;
}

interface Medicacao {
  id: string;
  nome: string;
  dose: string;
  via: string;
  frequencia: string;
  iniciadoEm: string;
}

interface NotaTurno {
  id: string;
  texto: string;
  criadaEm: string;
  autor: { id: string; nome: string; role: string };
}

const estadoCor: Record<string, { badge: string; dot: string }> = {
  estavel:       { badge: 'bg-green-50 text-green-700 border border-green-200',    dot: 'bg-green-500' },
  grave:         { badge: 'bg-orange-50 text-orange-700 border border-orange-200', dot: 'bg-orange-500' },
  critico:       { badge: 'bg-red-50 text-red-700 border border-red-200',           dot: 'bg-red-500' },
  alta_prevista: { badge: 'bg-blue-50 text-blue-700 border border-blue-200',        dot: 'bg-blue-500' },
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

const prioridadeCor: Record<string, string> = {
  baixa:   'bg-slate-100 text-slate-500',
  media:   'bg-blue-50 text-blue-600',
  alta:    'bg-orange-50 text-orange-600',
  urgente: 'bg-red-50 text-red-600',
};
const prioridadeLabel: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente',
};

const roleLabel: Record<string, string> = {
  enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar', medico: 'Médico',
  chefe_turno: 'Chefe Turno', chefe_enfermeiros: 'Chefe Enfermeiros', administrativo: 'Administrativo',
};

function calcIdade(dataNascimento: string) {
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

export default function DoenteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { utilizador } = useAuth();
  const [doente, setDoente] = useState<Doente | null>(null);
  const [loading, setLoading] = useState(true);
  const [alterandoEstado, setAlterandoEstado] = useState(false);
  const [confirmandoAlta, setConfirmandoAlta] = useState(false);
  const [salvandoAlta, setSalvandoAlta] = useState(false);

  const podeAlterarEstado = ['enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros'].includes(utilizador?.role ?? '');
  const podeDarAlta = ['administrativo', 'chefe_enfermeiros'].includes(utilizador?.role ?? '');

  const carregar = () => {
    setLoading(true);
    api.get(`/doentes/${id}`)
      .then((r) => setDoente(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, [id]);

  const alterarEstado = async (novoEstado: string) => {
    await api.patch(`/doentes/${id}/estado`, { estado: novoEstado });
    setAlterandoEstado(false);
    carregar();
  };

  const darAlta = async () => {
    setSalvandoAlta(true);
    try {
      await api.patch(`/doentes/${id}/alta`);
      router.push('/doentes');
    } finally {
      setSalvandoAlta(false);
      setConfirmandoAlta(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center gap-3 text-slate-400" style={{ paddingTop: '120px' }}>
      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-sm">A carregar...</span>
    </div>
  );

  if (!doente) return (
    <div className="text-center text-slate-400 text-sm" style={{ paddingTop: '120px' }}>Doente não encontrado</div>
  );

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Back */}
      <Link href="/doentes"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        style={{ marginBottom: '24px', display: 'inline-flex' }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Voltar a Doentes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <div className="flex items-center gap-3" style={{ marginBottom: '6px' }}>
            <h1 className="text-3xl font-bold text-slate-900">{doente.nome}</h1>
            <div className="relative">
              <button
                onClick={() => podeAlterarEstado && setAlterandoEstado((v) => !v)}
                className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-lg ${estadoCor[doente.estado]?.badge} ${podeAlterarEstado ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
                style={{ padding: '5px 10px' }}>
                <span className={`w-1.5 h-1.5 rounded-full ${estadoCor[doente.estado]?.dot}`} />
                {estadoLabel[doente.estado]}
                {podeAlterarEstado && (
                  <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
              {alterandoEstado && (
                <div className="absolute top-full left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden" style={{ marginTop: '6px', minWidth: '160px' }}>
                  {Object.entries(estadoLabel).map(([key, label]) => (
                    key !== doente.estado && (
                      <button key={key} onClick={() => alterarEstado(key)}
                        className="w-full flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                        style={{ padding: '10px 14px' }}>
                        <span className={`w-2 h-2 rounded-full ${estadoCor[key]?.dot}`} />
                        {label}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-slate-400 text-sm font-mono">{doente.numeroProcesso}</p>
        </div>

        {podeDarAlta && doente.ativo && (
          <button onClick={() => setConfirmandoAlta(true)}
            className="border border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50 text-sm font-medium rounded-xl transition-all"
            style={{ padding: '10px 20px' }}>
            Dar Alta
          </button>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-3 gap-5" style={{ marginBottom: '24px' }}>

        {/* Dados pessoais */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Dados Pessoais</span>
          </div>
          <div className="flex flex-col gap-4">
            <InfoRow label="Data de Nascimento" value={`${new Date(doente.dataNascimento).toLocaleDateString('pt-PT')} (${calcIdade(doente.dataNascimento)} anos)`} />
            <InfoRow label="Admissão" value={new Date(doente.dataAdmissao).toLocaleDateString('pt-PT')} />
            <InfoRow label="Alta Prevista" value={doente.dataAltaPrevista ? new Date(doente.dataAltaPrevista).toLocaleDateString('pt-PT') : '—'} />
          </div>
        </div>

        {/* Clínico */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Informação Clínica</span>
          </div>
          <InfoRow label="Diagnóstico Principal" value={doente.diagnosticoPrincipal} />
        </div>

        {/* Internamento */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Internamento</span>
          </div>
          <div className="flex flex-col gap-4">
            <InfoRow label="Cama" value={`Quarto ${doente.cama.quarto} · Cama ${doente.cama.numero}`} />
            <InfoRow
              label="Enfermeiros atribuídos"
              value={doente.atribuicoes.length > 0
                ? doente.atribuicoes.map((a) => a.enfermeiro.nome).join(', ')
                : <span className="text-slate-400">Nenhum atribuído</span>
              }
            />
          </div>
        </div>
      </div>

      {/* Medicação + Tarefas */}
      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>

        {/* Medicação */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <div className="w-7 h-7 rounded-lg bg-pink-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Medicação Ativa</span>
            {doente.medicacoes.length > 0 && (
              <span className="text-xs font-medium text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                {doente.medicacoes.length}
              </span>
            )}
          </div>
          {doente.medicacoes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>Sem medicação ativa</p>
          ) : (
            <div className="flex flex-col gap-3">
              {doente.medicacoes.map((m) => (
                <div key={m.id} className="flex items-start justify-between bg-slate-50 rounded-xl" style={{ padding: '12px 14px' }}>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{m.nome}</p>
                    <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>{m.dose} · {m.via} · {m.frequencia}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tarefas */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Tarefas Pendentes</span>
            {doente.tarefas.length > 0 && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
                {doente.tarefas.length}
              </span>
            )}
          </div>
          {doente.tarefas.length === 0 ? (
            <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>Sem tarefas pendentes</p>
          ) : (
            <div className="flex flex-col gap-3">
              {doente.tarefas.map((t) => (
                <div key={t.id} className="flex items-start gap-3 bg-slate-50 rounded-xl" style={{ padding: '12px 14px' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.descricao}</p>
                    <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>{t.tipo === 'clinica' ? 'Clínica' : 'Logística'}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md shrink-0 ${prioridadeCor[t.prioridade]}`}>
                    {prioridadeLabel[t.prioridade]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notas de turno */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Notas de Turno</span>
        </div>
        {doente.notasTurno.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>Sem notas registadas</p>
        ) : (
          <div className="flex flex-col gap-3">
            {doente.notasTurno.map((n) => (
              <div key={n.id} className="border-l-2 border-indigo-200 bg-indigo-50/40 rounded-r-xl" style={{ padding: '14px 16px' }}>
                <p className="text-sm text-slate-700 leading-relaxed">{n.texto}</p>
                <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
                  <span className="text-xs font-medium text-slate-500">{n.autor.nome}</span>
                  <span className="text-slate-300 text-xs">·</span>
                  <span className="text-xs text-slate-400">{roleLabel[n.autor.role] ?? n.autor.role}</span>
                  <span className="text-slate-300 text-xs">·</span>
                  <span className="text-xs text-slate-400">
                    {new Date(n.criadaEm).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal confirmar alta */}
      {confirmandoAlta && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '420px', padding: '32px' }}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center" style={{ marginBottom: '20px' }}>
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900" style={{ marginBottom: '8px' }}>Confirmar Alta</h3>
            <p className="text-slate-500 text-sm" style={{ marginBottom: '28px' }}>
              Tem a certeza que pretende dar alta a <strong>{doente.nome}</strong>? Esta ação irá libertar a cama e não pode ser revertida.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmandoAlta(false)}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>
                Cancelar
              </button>
              <button onClick={darAlta} disabled={salvandoAlta}
                className="flex-1 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-60 transition-colors"
                style={{ padding: '11px' }}>
                {salvandoAlta ? 'A processar...' : 'Confirmar Alta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
